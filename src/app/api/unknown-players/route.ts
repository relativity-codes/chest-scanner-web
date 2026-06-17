/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDiscordAlert } from "@/lib/discord";

// GET: Fetch unknown players for moderation on the web dashboard
export async function GET() {
  try {
    const list = await db.unknownPlayer.findMany({
      orderBy: { encountered: "desc" },
    });
    return NextResponse.json(list);
  } catch (error: any) {
    console.error("Failed to fetch unknown players:", error);
    await sendDiscordAlert(`GET /api/unknown-players Error: ${error.message || String(error)}`);
    return NextResponse.json(
      { error: "Failed to fetch unknown players" },
      { status: 500 }
    );
  }
}

// POST: Android client reports a newly encountered unknown name
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ocrName } = body;
    if (!ocrName || typeof ocrName !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const record = await db.unknownPlayer.upsert({
      where: { ocrName },
      update: {},
      create: { ocrName },
    });

    return NextResponse.json(record);
  } catch (error: any) {
    console.error("Failed to record unknown player:", error);
    await sendDiscordAlert(`POST /api/unknown-players Error: ${error.message || String(error)}`);
    return NextResponse.json({ error: "Failed to record" }, { status: 500 });
  }
}

// DELETE: Deletes from unknown log when whitelisted
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ocrName = searchParams.get("ocrName");
    const ocrNames = searchParams.get("ocrNames");

    if (ocrNames) {
      const names = ocrNames.split(",").map((n) => decodeURIComponent(n).trim()).filter(Boolean);
      await db.unknownPlayer.deleteMany({
        where: { ocrName: { in: names } },
      });
      return NextResponse.json({ success: true });
    }

    if (!ocrName) {
      return NextResponse.json(
        { error: "ocrName or ocrNames parameter required" },
        { status: 400 }
      );
    }

    await db.unknownPlayer.deleteMany({
      where: { ocrName },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete unknown player:", error);
    await sendDiscordAlert(`DELETE /api/unknown-players Error: ${error.message || String(error)}`);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
