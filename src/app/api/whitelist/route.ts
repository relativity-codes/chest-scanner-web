/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDiscordAlert } from "@/lib/discord";
import { getChestHistoryTimeFilter } from "@/lib/chest-history";

// GET: Return whitelisted players & corrections map
export async function GET() {
  try {
    const playersList = await db.player.findMany({
      select: { name: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    const fixesList = await db.playerFix.findMany({
      orderBy: { ocrName: "asc" },
    });

    // Group chests by player to find earliest scan time and total scan count (last 5 weeks)
    const statsList = await db.chest.groupBy({
      by: ["fromPlayer"],
      where: getChestHistoryTimeFilter(),
      _min: {
        time: true,
      },
      _count: {
        id: true,
      },
    });

    const firstAppearances: Record<string, string> = {};
    const totalAllTimeScans: Record<string, number> = {};

    // Build fixes map for canonicalization
    const fixesMap = new Map<string, string>();
    for (const f of fixesList) {
      fixesMap.set(f.ocrName, f.correctedTo);
    }

    // 1. Initialize maps with chest statistics
    for (const item of statsList) {
      if (item.fromPlayer) {
        const rawPlayer = item.fromPlayer;
        const player = fixesMap.get(rawPlayer) || rawPlayer;

        if (item._min.time) {
          const currentTime = item._min.time.toISOString();
          const existingTime = firstAppearances[player];
          if (!existingTime || new Date(currentTime) < new Date(existingTime)) {
            firstAppearances[player] = currentTime;
          }
        }
        totalAllTimeScans[player] = (totalAllTimeScans[player] || 0) + item._count.id;
      }
    }

    // 2. Map whitelisted players list and combine/supplement with player.createdAt
    const players = playersList.map((p: { name: string; createdAt: Date }) => {
      const name = p.name;
      const whitelistCreatedAt = p.createdAt.toISOString();
      const existingAppearance = firstAppearances[name];

      if (existingAppearance) {
        if (new Date(whitelistCreatedAt) < new Date(existingAppearance)) {
          firstAppearances[name] = whitelistCreatedAt;
        }
      } else {
        firstAppearances[name] = whitelistCreatedAt;
      }
      return name;
    });

    const fixes: Record<string, string> = {};
    for (const f of fixesList) {
      fixes[f.ocrName] = f.correctedTo;
    }

    return NextResponse.json({
      players,
      fixes,
      firstAppearances,
      totalAllTimeScans,
    });
  } catch (error: any) {
    console.error("Failed to fetch whitelist:", error);
    await sendDiscordAlert(`GET /api/whitelist Error: ${error.message || String(error)}`);
    return NextResponse.json(
      { error: "Failed to fetch whitelist" },
      { status: 500 }
    );
  }
}

// POST: Add a new player to the clan whitelist
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const player = await db.player.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    return NextResponse.json(player);
  } catch (error: any) {
    console.error("Failed to whitelist player:", error);
    await sendDiscordAlert(`POST /api/whitelist Error: ${error.message || String(error)}`);
    return NextResponse.json({ error: "Failed to whitelist" }, { status: 500 });
  }
}

// DELETE: Remove a player from the clan whitelist
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    await db.player.deleteMany({
      where: { name },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to remove player:", error);
    await sendDiscordAlert(`DELETE /api/whitelist Error: ${error.message || String(error)}`);
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
}
