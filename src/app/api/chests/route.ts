/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventEmitter, EVENTS } from "@/lib/emitter";
import { canonicalizePlayerName } from "@/lib/canonicalization";
import { sendDiscordAlert } from "@/lib/discord";

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

    const where: any = {};
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
