import { NextRequest, NextResponse } from "next/server";
import { getProduct, productImages, addProductImage } from "@/lib/repo";
import { toHandle } from "@/lib/slug";
import { MAX_SUBJECT_IMAGES } from "@/lib/limits";

// Attach an already-saved image (e.g. a refined result) to this product.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const product = getProduct(id);
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { url, label } = (await req.json()) as { url: string; label?: string };
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  if (productImages(id).length >= MAX_SUBJECT_IMAGES) {
    return NextResponse.json(
      { error: `Image limit reached (max ${MAX_SUBJECT_IMAGES}). Delete an image first.` },
      { status: 400 }
    );
  }

  addProductImage(id, url, toHandle(label ?? "") || "refined", false);
  return NextResponse.json({ images: productImages(id) });
}
