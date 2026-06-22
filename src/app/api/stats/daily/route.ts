import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateChestPoints } from "@/lib/chest-points";

function getUTC10DateOnly(date: Date | string): Date {
  const d = new Date(date);
  const utc10Time = d.getTime() + (10 * 60 * 60 * 1000);
  const utc10Date = new Date(utc10Time);
  return new Date(Date.UTC(utc10Date.getUTCFullYear(), utc10Date.getUTCMonth(), utc10Date.getUTCDate()));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const players = searchParams.getAll("player").filter(Boolean);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (players.length > 0) {
      // Find all OCR name variants that map to these corrected/canonical names
      const corrections = await db.playerFix.findMany({
        where: { correctedTo: { in: players } },
        select: { ocrName: true }
      });
      const namesToQuery = [...players, ...corrections.map((c) => c.ocrName)];
      
      where.fromPlayer = { in: namesToQuery };
    }

    // Fetch chests ordered by time ascending to process the timeline
    const chests = await db.chest.findMany({
      where,
      select: {
        time: true,
        chestName: true,
        source: true,
      },
      orderBy: { time: "asc" },
    });

    if (chests.length === 0) {
      return NextResponse.json([]);
    }

    // Map by date string (YYYY-MM-DD) in UTC+10
    const dailyMap: Record<string, { drops: number; wealth: number }> = {};

    chests.forEach((chest) => {
      const utc10Date = getUTC10DateOnly(chest.time);
      const dateStr = utc10Date.toISOString().split("T")[0]; // YYYY-MM-DD

      const points = calculateChestPoints(chest.chestName, chest.source);

      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { drops: 0, wealth: 0 };
      }
      dailyMap[dateStr].drops += 1;
      dailyMap[dateStr].wealth += points;
    });

    // Generate continuous list of dates from first to last
    const firstDate = getUTC10DateOnly(chests[0].time);
    const lastDate = getUTC10DateOnly(chests[chests.length - 1].time);

    const result = [];
    const currentDate = new Date(firstDate);

    while (currentDate <= lastDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const stats = dailyMap[dateStr] || { drops: 0, wealth: 0 };

      result.push({
        date: dateStr,
        drops: stats.drops,
        wealth: stats.wealth,
      });

      // Move to next day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to fetch daily stats:", error);
    return NextResponse.json({ error: "Failed to fetch daily stats" }, { status: 500 });
  }
}
