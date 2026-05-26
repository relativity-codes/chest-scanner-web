/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventEmitter, EVENTS } from "@/lib/emitter";
import { canonicalizePlayerName } from "@/lib/canonicalization";
import { sendDiscordAlert } from "@/lib/discord";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Expected an array of chest records" },
        { status: 400 }
      );
    }

    const createdChests = [];

    // Process sequentially to easily handle canonicalization logic per-player.
    for (const item of body) {
      const { chestName, fromPlayer, source, time, gameDay, originalTimer } = item;

      if (!chestName || !fromPlayer || !source || !time || !gameDay) {
        continue; // Skip invalid entries
      }

      const canonicalPlayer = await canonicalizePlayerName(fromPlayer);

      try {
        const chest = await db.chest.create({
          data: {
            chestName,
            fromPlayer: canonicalPlayer,
            source,
            time: new Date(time),
            gameDay,
            originalTimer: originalTimer || "",
          },
        });

        createdChests.push(chest);
        // Emit event for Server-Sent Events subscribers
        eventEmitter.emit(EVENTS.CHEST_SCANNED, chest);
      } catch (err: any) {
        // If it's a unique constraint violation (P2002), just skip it as it's already synced
        if (err.code !== 'P2002') {
          console.error("Failed to insert chest in batch:", err);
          await sendDiscordAlert(`Prisma Insert Error: ${err.message || String(err)}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: createdChests.length,
    });
  } catch (error: any) {
    console.error("Failed to batch save chest scans:", error);
    await sendDiscordAlert(`Batch Save Fatal Error: ${error.message || String(error)}`);
    return NextResponse.json(
      { error: "Failed to save chest scans" },
      { status: 500 }
    );
  }
}
