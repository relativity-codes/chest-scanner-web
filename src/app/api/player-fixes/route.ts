/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDiscordAlert } from "@/lib/discord";

// GET: Return all raw PlayerFix mapping rows
export async function GET() {
  try {
    const list = await db.playerFix.findMany({
      orderBy: { ocrName: "asc" },
    });
    return NextResponse.json(list);
  } catch (error: any) {
    console.error("Failed to fetch player fixes:", error);
    await sendDiscordAlert(`GET /api/player-fixes Error: ${error.message || String(error)}`);
    return NextResponse.json(
      { error: "Failed to fetch player fixes" },
      { status: 500 }
    );
  }
}

// POST: Add or update an OCR name correction mapping
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ocrName, correctedTo } = body;
    if (!ocrName || !correctedTo) {
      return NextResponse.json(
        { error: "ocrName and correctedTo are required" },
        { status: 400 }
      );
    }

    const record = await db.playerFix.upsert({
      where: { ocrName },
      update: { correctedTo },
      create: { ocrName, correctedTo },
    });

    return NextResponse.json(record);
  } catch (error: any) {
    console.error("Failed to add player fix:", error);
    await sendDiscordAlert(`POST /api/player-fixes Error: ${error.message || String(error)}`);
    return NextResponse.json(
      { error: "Failed to save player fix" },
      { status: 500 }
    );
  }
}

// DELETE: Remove an OCR name correction mapping
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ocrName = searchParams.get("ocrName");
    if (!ocrName) {
      return NextResponse.json(
        { error: "ocrName required" },
        { status: 400 }
      );
    }

    await db.playerFix.deleteMany({
      where: { ocrName },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete player fix:", error);
    await sendDiscordAlert(`DELETE /api/player-fixes Error: ${error.message || String(error)}`);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
