/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventEmitter, EVENTS } from "@/lib/emitter";
import { sendDiscordAlert } from "@/lib/discord";

function getUTC10GameDay(date: Date): string {
  const utc10Time = date.getTime() + (10 * 60 * 60 * 1000);
  const d = new Date(utc10Time);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `chests_${yyyy}-${mm}-${dd}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Expected an array of chest records" },
        { status: 400 }
      );
    }

    const validItems = body.filter(
      (item: any) =>
        item &&
        item.chestName &&
        item.fromPlayer &&
        item.source &&
        item.time &&
        item.gameDay
    );

    if (validItems.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
      });
    }

    // 1. Bulk resolve player name fixes
    const rawNames = Array.from(
      new Set(validItems.map((item: any) => item.fromPlayer.trim()).filter(Boolean))
    ) as string[];

    const fixes = await db.playerFix.findMany({
      where: { ocrName: { in: rawNames } },
    });

    const fixMap = new Map<string, string>();
    fixes.forEach((f) => {
      fixMap.set(f.ocrName, f.correctedTo);
    });

    // 2. Map raw names to corrected names, then deduplicate
    const correctedNames = Array.from(
      new Set(rawNames.map((name) => fixMap.get(name) || name))
    );

    // 3. Bulk check which corrected players exist in whitelist
    const players = await db.player.findMany({
      where: { name: { in: correctedNames } },
    });

    const whitelistNames = new Set(players.map((p) => p.name));

    // 4. Any name not in player whitelist gets logged as UnknownPlayer
    const unknownNames = correctedNames.filter((name) => !whitelistNames.has(name));
    if (unknownNames.length > 0) {
      await db.unknownPlayer.createMany({
        data: unknownNames.map((name) => ({ ocrName: name, encountered: new Date() })),
        skipDuplicates: true,
      });
    }

    // 5. Prepare normalized chest objects
    const chestData = validItems.map((item: any) => {
      const canonicalPlayer = fixMap.get(item.fromPlayer.trim()) || item.fromPlayer.trim();
      const itemTime = new Date(item.time);
      return {
        chestName: item.chestName.trim(),
        fromPlayer: canonicalPlayer,
        source: item.source.trim(),
        time: itemTime,
        gameDay: getUTC10GameDay(itemTime),
        originalTimer: item.originalTimer || "",
      };
    });

    // 6. Deduplicate internally in this batch to prevent uniqueness violations in the same transaction
    const uniqueChestMap = new Map<string, typeof chestData[0]>();
    chestData.forEach((item) => {
      const key = `${item.chestName}|${item.fromPlayer}|${item.source}|${item.time.getTime()}|${item.gameDay}`;
      if (!uniqueChestMap.has(key)) {
        uniqueChestMap.set(key, item);
      }
    });
    const finalChestsToProcess = Array.from(uniqueChestMap.values());

    // 7. Find which of these chests already exist in the database
    const existingChests = await db.chest.findMany({
      where: {
        OR: finalChestsToProcess.map((item) => ({
          chestName: item.chestName,
          fromPlayer: item.fromPlayer,
          source: item.source,
          time: item.time,
          gameDay: item.gameDay,
        })),
      },
    });

    const existingKeys = new Set(
      existingChests.map(
        (c) => `${c.chestName}|${c.fromPlayer}|${c.source}|${c.time.getTime()}|${c.gameDay}`
      )
    );

    const newChests = finalChestsToProcess.filter((item) => {
      const key = `${item.chestName}|${item.fromPlayer}|${item.source}|${item.time.getTime()}|${item.gameDay}`;
      return !existingKeys.has(key);
    });

    const createdChests = [];

    // 8. Insert new chests in a transaction and emit to SSE
    if (newChests.length > 0) {
      try {
        const created = await db.$transaction(
          newChests.map((data) => db.chest.create({ data }))
        );
        createdChests.push(...created);

        // Emit events for all newly created chests
        created.forEach((chest) => {
          eventEmitter.emit(EVENTS.CHEST_SCANNED, chest);
        });
      } catch (transactionError: any) {
        console.error("Failed transaction of batch chests insert, attempting fallback creates:", transactionError);
        // Fallback: create individually if transaction fails due to concurrent insertions
        for (const data of newChests) {
          try {
            const chest = await db.chest.create({ data });
            createdChests.push(chest);
            eventEmitter.emit(EVENTS.CHEST_SCANNED, chest);
          } catch (err: any) {
            if (err.code !== 'P2002') {
              console.error("Failed to insert chest during fallback batch creation:", err);
            }
          }
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
