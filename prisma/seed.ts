import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const INITIAL_PLAYERS = [
  "Ghost ANG 282", "Nifur", "TRIXxXsK", "SeasonalWitch", "Galafir",
  "PapaHanys1", "Agamamand", "AXESTONE DLo", "LADY J", "UltraBeerRuners",
  "Greyndrogud", "Don Chichot", "Arfir", "Chaac", "Aster",
  "Bludbringer", "Elrohan", "Jatt III", "Fotius", "Lirafin",
  "Bombi", "Nahla SK6", "Hell is Hot", "yoda765", "Morfir",
  "FrauRubur SK", "Bonara", "Flemisch Warrior SK", "Pork Chop Xpress SK", "Saithiril",
  "Daitaxe", "Garon", "John Maze SK", "PUNISHER", "xGURAYx",
  "Fundaing", "Auzar", "IronReaper", "Maximus II", "PUNISHER 2",
  "Ilroseyl", "Earrafad", "Balladodor", "Thonis", "Galael",
  "Athena²", "Ballaris", "Agalanim", "Aarezher", "Relativity"
];

const INITIAL_FIXES = {
  "JayR3e 1": "Relativity",
  "JayR3E I": "Relativity",
  "JayR3E I1": "Relativity",
  "JayR3E Ii": "Relativity",
  "JayR3E Il": "Relativity",
  "JayR3E SKS": "Relativity SK5",
  "Ghost?": "Ghost²",
  "Raven": "RaveN",
  "Medellin antoquia": "Medellin Antoquia",
  "Medellin Antoquia": "Medellin Antoquia",
  "CroOwD": "CrOwD",
  "El Le6n LLA": "El León LLA",
  "El Leén LLA": "El León LLA",
  "El Leén LLA II": "El León LLA II",
  "El Leén LLA Il": "El León LLA II",
  "Caldas Antioquta": "Caldas Antioquia",
  "al bAsTi": "aL bAsTi",
  "GHosT": "GHoST",
  "TRIXXxX": "TRIXxX",
  "TRIXX": "TRIxX",
  "Laporte I!": "Laporte II",
  "Plaveroo1": "Player001",
  "Playeroo1": "Player001",
  "$$ es 9": "CroOwD"
};

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Seed Players Whitelist
  console.log(`Players count to seed: ${INITIAL_PLAYERS.length}`);
  for (const name of INITIAL_PLAYERS) {
    await prisma.player.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 2. Seed Name Corrections fixes
  console.log(`Fixes count to seed: ${Object.keys(INITIAL_FIXES).length}`);
  for (const [ocrName, correctedTo] of Object.entries(INITIAL_FIXES)) {
    await prisma.playerFix.upsert({
      where: { ocrName },
      update: { correctedTo },
      create: { ocrName, correctedTo },
    });
  }

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Process exit cleans up database hooks
  });
