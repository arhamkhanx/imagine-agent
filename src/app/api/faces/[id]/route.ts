import { NextRequest, NextResponse } from "next/server";
import { getFace, updateFace, deleteFace, faceImages } from "@/lib/repo";
import { uniqueHandle } from "@/lib/slug";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const face = getFace(id);
  if (!face) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  const name = body.name ? uniqueHandle("faces", face.brand_id, body.name, id) : face.name;
  const description = body.description ?? face.description;
  updateFace(id, name, description);
  return NextResponse.json({ ...getFace(id), images: faceImages(id) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteFace(id);
  return NextResponse.json({ ok: true });
}
