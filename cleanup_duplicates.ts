import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const chests = await prisma.chest.findMany();
  
  const uniqueChests = new Map();
  const duplicates = [];
  
  for (const chest of chests) {
    const key = `${chest.chestName}-${chest.fromPlayer}-${chest.source}-${chest.time.getTime()}-${chest.gameDay}`;
    if (uniqueChests.has(key)) {
      duplicates.push(chest.id);
    } else {
      uniqueChests.set(key, chest.id);
    }
  }
  
  console.log(`Found ${duplicates.length} duplicate chests.`);
  
  if (duplicates.length > 0) {
    const res = await prisma.chest.deleteMany({
      where: {
        id: {
          in: duplicates
        }
      }
    });
    console.log(`Deleted ${res.count} duplicate chests.`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
