import { db } from "@/lib/db";

export async function canonicalizePlayerName(rawName: string): Promise<string> {
  let finalPlayerName = rawName.trim();

  // 1. Check PlayerFix table for corrections
  const fix = await db.playerFix.findUnique({
    where: { ocrName: finalPlayerName },
  });

  if (fix) {
    finalPlayerName = fix.correctedTo;
  }

  // 2. Check if player exists in the canonical whitelist
  const player = await db.player.findUnique({
    where: { name: finalPlayerName },
  });

  if (!player) {
    // 3. Log as UnknownPlayer if not found (upsert to avoid UniqueConstraint errors)
    await db.unknownPlayer.upsert({
      where: { ocrName: finalPlayerName },
      update: { encountered: new Date() },
      create: { ocrName: finalPlayerName },
    });
  }

  return finalPlayerName;
}
