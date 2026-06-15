import { NextRequest, NextResponse } from "next/server";
import { getFaceImage, faceImages, deleteFaceImage, setFacePrimary } from "@/lib/repo";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await ctx.params;
  const img = getFaceImage(imageId);
  if (!img || img.face_id !== id) return NextResponse.json({ error: "not found" }, { status: 404 });
  setFacePrimary(id, imageId);
  return NextResponse.json({ images: faceImages(id) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await ctx.params;
  const img = getFaceImage(imageId);
  if (!img || img.face_id !== id) return NextResponse.json({ error: "not found" }, { status: 404 });

  const all = faceImages(id);
  if (all.length <= 1) {
    return NextResponse.json({ error: "Cannot delete the only image" }, { status: 400 });
  }
  const wasPrimary = img.is_primary === 1;
  deleteFaceImage(imageId);
  if (wasPrimary) {
    const remaining = faceImages(id);
    if (remaining[0]) setFacePrimary(id, remaining[0].id);
  }
  return NextResponse.json({ images: faceImages(id) });
}
