/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Return whitelisted players & corrections map
export async function GET() {
  try {
    const playersList = await db.player.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });
    const fixesList = await db.playerFix.findMany({
      orderBy: { ocrName: "asc" },
    });

    const players = playersList.map((p: { name: any; }) => p.name);
    const fixes: Record<string, string> = {};
    for (const f of fixesList) {
      fixes[f.ocrName] = f.correctedTo;
    }

    return NextResponse.json({ players, fixes });
  } catch (error) {
    console.error("Failed to fetch whitelist:", error);
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
  } catch (error) {
    console.error("Failed to whitelist player:", error);
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
  } catch (error) {
    console.error("Failed to remove player:", error);
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
}
