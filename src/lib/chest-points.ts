/**
 * Parses the level of a chest from its name or source description.
 */
export function parseChestLevel(chestName: string, source: string): number {
  const cn = chestName.toLowerCase();
  const src = (source || "").toLowerCase();
  const fullText = `${cn} ${src}`;

  let level = 0;
  const levelRegex = /(?:level|lvl|lvl\.|level\.)\s*(\d+)/i;
  const match = fullText.match(levelRegex);
  if (match) {
    level = parseInt(match[1], 10);
  } else {
    const numMatch = fullText.match(/\b(5|10|15|20|25|30|35)\b/);
    if (numMatch) {
      level = parseInt(numMatch[1], 10);
    }
  }
  return level;
}

/**
 * Calculates the wealth points for a scanned chest based on its name, source, and level.
 */
export function calculateChestPoints(chestName: string, source: string): number {
  const cn = chestName.toLowerCase();
  const src = (source || "").toLowerCase();
  const fullText = `${cn} ${src}`;

  const level = parseChestLevel(chestName, source);

  // Identify Category
  const isLegendary = cn.includes("legendary") || cn.includes("gold");
  const isCitadel = fullText.includes("citadel");
  const isEpic = fullText.includes("epic") || fullText.includes("dragon");
  const isRare = fullText.includes("rare") || cn.includes("minotaur") || cn.includes("wyvern");

  if (isLegendary) {
    return 1500;
  }

  if (isEpic) {
    if (level <= 15) return 75;
    if (level <= 20) return 598;
    if (level <= 25) return 1000;
    if (level <= 30) return 1184;
    return 1484; // level 35
  }

  if (isRare) {
    if (level <= 10) return 66;
    if (level <= 15) return 130;
    if (level <= 20) return 319;
    if (level <= 25) return 800;
    return 1200; // level 30
  }

  if (isCitadel) {
    if (level <= 10) return 18;
    if (level <= 15) return 30;
    if (level <= 20) return 50;
    if (level <= 25) return 120;
    return 200; // level 30
  }

  // Fallback to Common Crypt
  if (level <= 5) return 13;
  if (level <= 10) return 35;
  if (level <= 15) return 75;
  if (level <= 20) return 167;
  return 550; // level 25
}
