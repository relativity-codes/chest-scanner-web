/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { eventEmitter, EVENTS } from "@/lib/emitter";
import { sendDiscordAlert } from "@/lib/discord";
import { refreshCanonicalizationCache } from "@/lib/canonicalization";

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

    // 1. Bulk resolve player name fixes utilizing in-memory cache to save DB calls
    const { whitelist: whitelistNames, fixes: fixMap } = await refreshCanonicalizationCache();

    // 2. Map raw names to corrected names, then deduplicate
    const rawNames = Array.from(
      new Set(validItems.map((item: any) => item.fromPlayer.trim()).filter(Boolean))
    ) as string[];

    const correctedNames = Array.from(
      new Set(rawNames.map((name) => fixMap.get(name) || name))
    );

    // 3. Any name not in player whitelist gets logged as UnknownPlayer (writes only when unrecognized)
    const unknownNames = correctedNames.filter((name) => !whitelistNames.has(name));
    if (unknownNames.length > 0) {
      await db.unknownPlayer.createMany({
        data: unknownNames.map((name) => ({ ocrName: name, encountered: new Date() })),
        skipDuplicates: true,
      });
    }

    // 4. Prepare normalized chest objects
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

    // 5. Deduplicate internally in this batch to prevent uniqueness violations in the same transaction
    const uniqueChestMap = new Map<string, typeof chestData[0]>();
    chestData.forEach((item) => {
      const key = `${item.chestName}|${item.fromPlayer}|${item.source}|${item.time.getTime()}|${item.gameDay}`;
      if (!uniqueChestMap.has(key)) {
        uniqueChestMap.set(key, item);
      }
    });
    const finalChestsToProcess = Array.from(uniqueChestMap.values());

    const createdChests = [];

    // Helper to chunk array (for fallback query)
    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    // 6. Write-first bulk insertion & deduplication (createMany with skipDuplicates)
    // We execute the bulk insert first. Under normal operations (no duplicate retries),
    // this handles both insertion and database deduplication in exactly ONE database call!
    if (finalChestsToProcess.length > 0) {
      const chestsWithIds = finalChestsToProcess.map((item) => ({
        id: randomUUID(),
        ...item,
        createdAt: new Date(),
      }));

      try {
        const insertResult = await db.chest.createMany({
          data: chestsWithIds,
          skipDuplicates: true,
        });

        // Optimization: if all chests were inserted successfully, none of them were duplicates.
        // We can emit all of them without query/roundtrip overhead!
        if (insertResult.count === chestsWithIds.length) {
          createdChests.push(...chestsWithIds);
          chestsWithIds.forEach((chest) => {
            eventEmitter.emit(EVENTS.CHEST_SCANNED, chest as any);
          });
        } else {
          // If some chests were duplicates, run a fallback read query to identify the duplicates
          // and only emit events for the truly new ones. This keeps SSE events 100% accurate.
          const dbChunks = chunkArray(chestsWithIds, 100);
          const existingChestsResults = await Promise.all(
            dbChunks.map((chunk) =>
              db.chest.findMany({
                where: {
                  OR: chunk.map((item) => ({
                    chestName: item.chestName,
                    fromPlayer: item.fromPlayer,
                    source: item.source,
                    time: item.time,
                    gameDay: item.gameDay,
                  })),
                },
              })
            )
          );
          const existingChests = existingChestsResults.flat();
          const existingKeys = new Set(
            existingChests.map(
              (c) => `${c.chestName}|${c.fromPlayer}|${c.source}|${c.time.getTime()}|${c.gameDay}`
            )
          );

          const newChests = chestsWithIds.filter((item) => {
            const key = `${item.chestName}|${item.fromPlayer}|${item.source}|${item.time.getTime()}|${item.gameDay}`;
            return !existingKeys.has(key);
          });

          createdChests.push(...newChests);
          newChests.forEach((chest) => {
            eventEmitter.emit(EVENTS.CHEST_SCANNED, chest as any);
          });
        }
      } catch (insertError: any) {
        console.error("Failed bulk insert of batch chests, attempting fallback creates:", insertError);
        // Fallback: create individually if bulk insert fails
        for (const data of chestsWithIds) {
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
