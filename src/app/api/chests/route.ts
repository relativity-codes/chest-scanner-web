/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventEmitter, EVENTS } from "@/lib/emitter";
import { canonicalizePlayerName } from "@/lib/canonicalization";
import { sendDiscordAlert } from "@/lib/discord";
import { getChestHistoryTimeFilter } from "@/lib/chest-history";

function getUTC10GameDay(date: Date): string {
  const utc10Time = date.getTime() + (10 * 60 * 60 * 1000);
  const d = new Date(utc10Time);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `chests_${yyyy}-${mm}-${dd}`;
}

// GET: Fetch chest scans
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const gameDay = searchParams.get("gameDay");

    const where: any = {
      ...getChestHistoryTimeFilter(),
    };
    if (gameDay) {
      where.gameDay = gameDay;
    }

    const queryOptions: any = {
      where,
      orderBy: { time: "desc" },
    };

    if (limitParam && limitParam !== "all") {
      const parsedLimit = parseInt(limitParam);
      if (!isNaN(parsedLimit)) {
        queryOptions.take = parsedLimit;
      }
    }

    const chests = await db.chest.findMany(queryOptions);

    return NextResponse.json(chests);
  } catch (error: any) {
    console.error("Failed to fetch chests:", error);
    await sendDiscordAlert(`GET /api/chests Error: ${error.message || String(error)}`);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST: Add new chest scan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chestName, fromPlayer, source, time, gameDay, originalTimer } = body;

    if (!chestName || !fromPlayer || !source || !time || !gameDay) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const canonicalPlayer = await canonicalizePlayerName(fromPlayer);

    const chestTime = new Date(time);

    const chest = await db.chest.create({
      data: {
        chestName,
        fromPlayer: canonicalPlayer,
        source,
        time: chestTime,
        gameDay: getUTC10GameDay(chestTime),
        originalTimer: originalTimer || "",
      },
    });

    // Emit event for Server-Sent Events subscribers
    eventEmitter.emit(EVENTS.CHEST_SCANNED, chest);

    return NextResponse.json(chest);
  } catch (error: any) {
    console.error("Failed to save chest scan:", error);
    await sendDiscordAlert(`POST /api/chests Error: ${error.message || String(error)}`);
    return NextResponse.json(
      { error: "Failed to save chest scan" },
      { status: 500 }
    );
  }
}

// DELETE: Delete entire player contribution (all chest scans) for a specific player
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const player = searchParams.get("player");
    const secretKey = searchParams.get("secretKey");

    if (!player) {
      return NextResponse.json(
        { error: "Player parameter is required" },
        { status: 400 }
      );
    }

    const expectedKey = process.env.DELETE_SECRET_KEY;
    if (!expectedKey) {
      return NextResponse.json(
        { error: "Delete secret key is not configured on the server" },
        { status: 500 }
      );
    }

    if (secretKey !== expectedKey) {
      return NextResponse.json(
        { error: "Invalid secret key" },
        { status: 401 }
      );
    }

    const canonicalPlayer = await canonicalizePlayerName(player);

    // Find all OCR name variants associated with this player
    const corrections = await db.playerFix.findMany({
      where: {
        OR: [
          { correctedTo: canonicalPlayer },
          { correctedTo: player }
        ]
      },
      select: { ocrName: true }
    });
    const namesToClean = Array.from(new Set([
      canonicalPlayer,
      player,
      ...corrections.map((c) => c.ocrName)
    ]));

    // Transaction to safely delete chests, whitelist, unknown logs, and corrections
    const [deleteChestsResult] = await db.$transaction([
      db.chest.deleteMany({
        where: {
          fromPlayer: { in: namesToClean },
        },
      }),
      db.player.deleteMany({
        where: {
          name: { in: namesToClean },
        },
      }),
      db.unknownPlayer.deleteMany({
        where: {
          ocrName: { in: namesToClean },
        },
      }),
      db.playerFix.deleteMany({
        where: {
          OR: [
            { ocrName: { in: namesToClean } },
            { correctedTo: { in: namesToClean } }
          ]
        },
      }),
    ]);

    await sendDiscordAlert(
      `🗑️ **Contributions & Identity Deleted**: All ${deleteChestsResult.count} chest scans and all whitelist/moderation records for player **${canonicalPlayer}** (and associated aliases) have been permanently deleted by an admin.`
    );

    return NextResponse.json({
      success: true,
      count: deleteChestsResult.count,
    });
  } catch (error: any) {
    console.error("Failed to delete player contributions:", error);
    await sendDiscordAlert(`DELETE /api/chests Error: ${error.message || String(error)}`);
    return NextResponse.json(
      { error: "Failed to delete player contributions" },
      { status: 500 }
    );
  }
}

