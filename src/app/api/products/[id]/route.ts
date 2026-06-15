import { NextRequest, NextResponse } from "next/server";
import { getProduct, updateProduct, deleteProduct, productImages } from "@/lib/repo";
import { uniqueHandle } from "@/lib/slug";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const product = getProduct(id);
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  const name = body.name ? uniqueHandle("products", product.brand_id, body.name, id) : product.name;
  const description = body.description ?? product.description;
  updateProduct(id, name, description);
  return NextResponse.json({ ...getProduct(id), images: productImages(id) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteProduct(id);
  return NextResponse.json({ ok: true });
}
