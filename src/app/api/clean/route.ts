import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getChestHistoryTimeFilter } from '@/lib/chest-history';

export async function GET() {
  const chests = await db.chest.findMany({
    where: getChestHistoryTimeFilter(),
  });
  
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
  
  if (duplicates.length > 0) {
    await db.chest.deleteMany({
      where: {
        id: { in: duplicates }
      }
    });
  }
  return NextResponse.json({ deleted: duplicates.length });
}
