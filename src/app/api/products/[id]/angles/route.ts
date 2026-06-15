import { NextRequest, NextResponse } from "next/server";
import { getProduct, productImages, addProductImage } from "@/lib/repo";
import { urlToModelDataUri, saveDataUri, saveRemote } from "@/lib/storage";
import { editImage } from "@/lib/xai";
import { PHOTOREALISM } from "@/lib/agent";
import { MAX_SUBJECT_IMAGES } from "@/lib/limits";

const ANGLE_PROMPTS: Record<string, string> = {
  front: "straight-on front view of the product",
  back: "rear view showing the back of the product",
  side: "side profile view of the product",
  three_quarter: "three-quarter angled view showing depth and form",
  detail_closeup: "extreme macro close-up of the key material, stitching and hardware details",
  flat_lay: "flat lay top-down view of the product neatly arranged",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const product = getProduct(id);
    if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

    const { angles } = (await req.json()) as { angles: string[] };
    const imgs = productImages(id);
    const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
    if (!primary) return NextResponse.json({ error: "product has no source image" }, { status: 400 });

    const remaining = MAX_SUBJECT_IMAGES - imgs.length;
    if (remaining <= 0) {
      return NextResponse.json(
        { error: `Image limit reached (max ${MAX_SUBJECT_IMAGES}). Delete an image first.` },
        { status: 400 }
      );
    }
    const toGenerate = angles.slice(0, remaining);

    const sourceDataUri = await urlToModelDataUri(primary.url);
    const created = [];
    for (const angle of toGenerate) {
      const desc = ANGLE_PROMPTS[angle] ?? angle;
      const img = await editImage(
        `Keep this exact same product — identical design, colour, material, cut and all details. Re-photograph it as a ${desc}. Maintain the same clean seamless studio background, soft three-point lighting, lens and true-to-life colour for a consistent product set. Crisp focus on the material and texture (visible weave, stitching, hardware). ${PHOTOREALISM}`,
        [sourceDataUri],
        "1:1"
      );
      const url = img.dataUri ? await saveDataUri(img.dataUri) : await saveRemote(img.url!);
      created.push(addProductImage(id, url, angle, false));
    }
    return NextResponse.json({
      images: productImages(id),
      created,
      skipped: angles.length - toGenerate.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
