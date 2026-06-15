import { NextRequest, NextResponse } from "next/server";
import { getProductImage, productImages, deleteProductImage, setProductPrimary } from "@/lib/repo";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await ctx.params;
  const img = getProductImage(imageId);
  if (!img || img.product_id !== id) return NextResponse.json({ error: "not found" }, { status: 404 });
  setProductPrimary(id, imageId);
  return NextResponse.json({ images: productImages(id) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await ctx.params;
  const img = getProductImage(imageId);
  if (!img || img.product_id !== id) return NextResponse.json({ error: "not found" }, { status: 404 });

  const all = productImages(id);
  if (all.length <= 1) {
    return NextResponse.json({ error: "Cannot delete the only image" }, { status: 400 });
  }
  const wasPrimary = img.is_primary === 1;
  deleteProductImage(imageId);
  if (wasPrimary) {
    const remaining = productImages(id);
    if (remaining[0]) setProductPrimary(id, remaining[0].id);
  }
  return NextResponse.json({ images: productImages(id) });
}
