import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventEmitter, EVENTS } from "@/lib/emitter";

// GET: Fetch chest scans
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "1000");

    const chests = await db.chest.findMany({
      orderBy: { time: "desc" },
      take: limit,
    });

    return NextResponse.json(chests);
  } catch (error) {
    console.error("Failed to fetch chests:", error);
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

    const chest = await db.chest.create({
      data: {
        chestName,
        fromPlayer,
        source,
        time: new Date(time),
        gameDay,
        originalTimer: originalTimer || "",
      },
    });

    // Emit event for Server-Sent Events subscribers
    eventEmitter.emit(EVENTS.CHEST_SCANNED, chest);

    return NextResponse.json(chest);
  } catch (error) {
    console.error("Failed to save chest scan:", error);
    return NextResponse.json(
      { error: "Failed to save chest scan" },
      { status: 500 }
    );
  }
}
