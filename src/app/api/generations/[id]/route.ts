import { NextRequest, NextResponse } from "next/server";
import { getGeneration, deleteGeneration } from "@/lib/repo";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getGeneration(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  deleteGeneration(id);
  return NextResponse.json({ ok: true });
}
