import { db } from "@/lib/db";

// In-memory cache for player fixes and whitelist to minimize database calls
let cachedPlayers: Set<string> | null = null;
let cachedFixes: Map<string, string> | null = null;
let lastCacheFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function refreshCanonicalizationCache(): Promise<{ whitelist: Set<string>; fixes: Map<string, string> }> {
  const now = Date.now();
  if (!cachedPlayers || !cachedFixes || (now - lastCacheFetch > CACHE_TTL_MS)) {
    try {
      const [players, fixes] = await Promise.all([
        db.player.findMany({ select: { name: true } }),
        db.playerFix.findMany({ select: { ocrName: true, correctedTo: true } }),
      ]);

      cachedPlayers = new Set(players.map((p) => p.name));
      cachedFixes = new Map(fixes.map((f) => [f.ocrName, f.correctedTo]));
      lastCacheFetch = now;
      console.log(`[DB Cache] Refreshed player whitelist (${cachedPlayers.size}) and fixes (${cachedFixes.size})`);
    } catch (err) {
      console.error("[DB Cache] Failed to refresh cache, using stale data:", err);
      if (!cachedPlayers) cachedPlayers = new Set();
      if (!cachedFixes) cachedFixes = new Map();
    }
  }
  return { whitelist: cachedPlayers, fixes: cachedFixes };
}

export async function canonicalizePlayerName(rawName: string): Promise<string> {
  const finalPlayerName = rawName.trim();
  
  const { whitelist, fixes } = await refreshCanonicalizationCache();

  // 1. Check PlayerFix mapping for corrections
  const corrected = fixes.get(finalPlayerName) || finalPlayerName;

  // 2. Check if player exists in the canonical whitelist
  if (!whitelist.has(corrected)) {
    try {
      // 3. Log as UnknownPlayer if not found (upsert to avoid UniqueConstraint errors)
      await db.unknownPlayer.upsert({
        where: { ocrName: corrected },
        update: { encountered: new Date() },
        create: { ocrName: corrected },
      });
    } catch (err) {
      console.error("[DB] Failed to upsert unknown player:", err);
    }
  }

  return corrected;
}
