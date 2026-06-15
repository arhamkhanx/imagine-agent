import { NextRequest, NextResponse } from "next/server";
import {
  getFaceImage,
  getProductImage,
  getGeneration,
  faceImages,
  productImages,
  addFaceImage,
  addProductImage,
  createGeneration,
  type AssetType,
} from "@/lib/repo";
import { MAX_SUBJECT_IMAGES } from "@/lib/limits";
import { nanoid } from "nanoid";

// Turn a specific version (image url) into a new, independent asset.
export async function POST(req: NextRequest) {
  try {
    const { assetType, assetId, url } = (await req.json()) as {
      assetType: AssetType;
      assetId: string;
      url: string;
    };
    if (!assetType || !assetId || !url) {
      return NextResponse.json({ error: "assetType, assetId and url required" }, { status: 400 });
    }

    if (assetType === "face_image") {
      const src = getFaceImage(assetId);
      if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (faceImages(src.face_id).length >= MAX_SUBJECT_IMAGES) {
        return NextResponse.json(
          { error: `Image limit reached (max ${MAX_SUBJECT_IMAGES}) for this face.` },
          { status: 400 }
        );
      }
      const img = addFaceImage(src.face_id, url, "forked", false);
      return NextResponse.json({ kind: "face_image", image: img });
    }

    if (assetType === "product_image") {
      const src = getProductImage(assetId);
      if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (productImages(src.product_id).length >= MAX_SUBJECT_IMAGES) {
        return NextResponse.json(
          { error: `Image limit reached (max ${MAX_SUBJECT_IMAGES}) for this product.` },
          { status: 400 }
        );
      }
      const img = addProductImage(src.product_id, url, "forked", false);
      return NextResponse.json({ kind: "product_image", image: img });
    }

    if (assetType === "generation") {
      const src = getGeneration(assetId);
      if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
      const gen = createGeneration({
        brand_id: src.brand_id,
        batch_id: nanoid(10),
        instruction: `${src.instruction} (forked version)`,
        final_prompt: src.final_prompt,
        agent_notes: src.agent_notes,
        refs: src.refs,
        url,
        aspect_ratio: src.aspect_ratio,
        status: "done",
        error: null,
      });
      return NextResponse.json({ kind: "generation", generation: gen });
    }

    return NextResponse.json({ error: "This asset type cannot be forked" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
