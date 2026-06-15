import { NextRequest, NextResponse } from "next/server";
import { getBrand, updateBrand, deleteBrand, brandCount } from "@/lib/repo";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getBrand(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  updateBrand(id, name.trim());
  return NextResponse.json(getBrand(id));
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getBrand(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (brandCount() <= 1) {
    return NextResponse.json({ error: "Cannot delete your only brand" }, { status: 400 });
  }
  deleteBrand(id);
  return NextResponse.json({ ok: true });
}
