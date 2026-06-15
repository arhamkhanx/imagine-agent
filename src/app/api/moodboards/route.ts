import { NextRequest, NextResponse } from "next/server";
import { listMoodboards, moodboardItems, createMoodboard } from "@/lib/repo";
import { uniqueHandle, toHandle } from "@/lib/slug";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  if (!brand) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const boards = listMoodboards(brand).map((m) => ({ ...m, items: moodboardItems(m.id) }));
  return NextResponse.json(boards);
}

export async function POST(req: NextRequest) {
  const { brandId, name } = await req.json();
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });
  const handle = uniqueHandle("moodboards", brandId, name ? toHandle(name) : "moodboard");
  const board = createMoodboard(brandId, handle);
  return NextResponse.json({ ...board, items: [] });
}
