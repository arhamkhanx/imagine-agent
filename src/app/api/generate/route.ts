import { NextRequest, NextResponse } from "next/server";
import {
  listFaces,
  listProducts,
  listMoodboards,
  faceImages,
  productImages,
  createGeneration,
} from "@/lib/repo";
import { urlToModelDataUri, saveDataUri, saveRemote } from "@/lib/storage";
import { generateImage, editImage } from "@/lib/xai";
import { planGeneration, type FaceRef, type ProductRef, type MoodboardRef } from "@/lib/agent";
import { nanoid } from "nanoid";

function mentions(text: string): Set<string> {
  const set = new Set<string>();
  for (const m of text.matchAll(/@([a-z0-9_]+)/g)) set.add(m[1]);
  return set;
}

export async function POST(req: NextRequest) {
  try {
    const { brandId, instruction, aspectRatio = "1:1", count = 1 } = (await req.json()) as {
      brandId: string;
      instruction: string;
      aspectRatio?: string;
      count?: number;
    };
    if (!brandId || !instruction?.trim()) {
      return NextResponse.json({ error: "brandId and instruction required" }, { status: 400 });
    }
    const variants = Math.min(4, Math.max(1, Math.round(count) || 1));

    const wanted = mentions(instruction);

    const allFaces = listFaces(brandId);
    const allProducts = listProducts(brandId);
    const allMoodboards = listMoodboards(brandId);

    // If specific handles are mentioned, restrict to those; otherwise use none of each
    // type unless mentioned (keeps prompts focused).
    const selFaces = allFaces.filter((f) => wanted.has(f.name));
    const selProducts = allProducts.filter((p) => wanted.has(p.name));
    const selMoodboards = allMoodboards.filter((m) => wanted.has(m.name));

    // The agent gets ALL angles of each subject (so it can study identity/design
    // from every view); the image editor only receives the curated primary image.
    const faceRefs: FaceRef[] = [];
    const faceSourceUris: string[] = [];
    for (const f of selFaces) {
      const imgs = faceImages(f.id);
      const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
      const allUris = await Promise.all(imgs.map((i) => urlToModelDataUri(i.url)));
      if (primary) faceSourceUris.push(await urlToModelDataUri(primary.url));
      faceRefs.push({ handle: f.name, description: f.description, imageDataUris: allUris });
    }

    const productRefs: ProductRef[] = [];
    const productSourceUris: string[] = [];
    for (const p of selProducts) {
      const imgs = productImages(p.id);
      const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
      const allUris = await Promise.all(imgs.map((i) => urlToModelDataUri(i.url)));
      if (primary) productSourceUris.push(await urlToModelDataUri(primary.url));
      productRefs.push({ handle: p.name, description: p.description, imageDataUris: allUris });
    }

    const moodboardRefs: MoodboardRef[] = selMoodboards.map((m) => ({
      handle: m.name,
      description: m.description,
    }));

    // Reference images passed to the image editor (face first, then product), max 3.
    const sourceImages = [...faceSourceUris, ...productSourceUris].slice(0, 3);
    const hasSourceImages = sourceImages.length > 0;

    // Agent writes the optimal prompt.
    const plan = await planGeneration({
      instruction,
      faces: faceRefs,
      products: productRefs,
      moodboards: moodboardRefs,
      aspectRatio,
      hasSourceImages,
    });

    const refs = JSON.stringify({
      faces: selFaces.map((f) => f.name),
      products: selProducts.map((p) => p.name),
      moodboards: selMoodboards.map((m) => m.name),
    });
    const batchId = nanoid(10);

    // Render N variants from the same agent prompt (the image model is stochastic).
    const renderOne = async () => {
      const result = hasSourceImages
        ? await editImage(plan.prompt, sourceImages, aspectRatio)
        : await generateImage(plan.prompt, aspectRatio);
      const url = result.dataUri ? await saveDataUri(result.dataUri) : await saveRemote(result.url!);
      return createGeneration({
        brand_id: brandId,
        batch_id: batchId,
        instruction,
        final_prompt: plan.prompt,
        agent_notes: plan.rationale,
        refs,
        url,
        aspect_ratio: aspectRatio,
        status: "done",
        error: null,
      });
    };

    const gens = await Promise.all(Array.from({ length: variants }, renderOne));
    return NextResponse.json(gens);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
