import { NextRequest, NextResponse } from "next/server";
import { createGeneration } from "@/lib/repo";
import { urlToModelDataUri, dataUriToModelDataUri, saveDataUri, saveRemote } from "@/lib/storage";
import { editImage } from "@/lib/xai";
import { planRefinement } from "@/lib/agent";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const {
      brandId,
      imageUrl,
      instruction,
      attachments = [],
      contextLabel = "an image",
      aspectRatio = "auto",
    } = (await req.json()) as {
      brandId: string;
      imageUrl: string;
      instruction: string;
      attachments?: string[]; // data URIs
      contextLabel?: string;
      aspectRatio?: string;
    };

    if (!brandId || !imageUrl || !instruction?.trim()) {
      return NextResponse.json(
        { error: "brandId, imageUrl and instruction required" },
        { status: 400 }
      );
    }

    const sourceDataUri = await urlToModelDataUri(imageUrl);
    const attachmentDataUris = await Promise.all(
      (attachments || []).slice(0, 2).map((a) => dataUriToModelDataUri(a))
    );

    // Agent analyzes the image + intent + samples and writes the edit prompt.
    const plan = await planRefinement({
      instruction,
      contextLabel,
      sourceDataUri,
      attachmentDataUris,
    });

    // Edit: source first, then any attachments as references (max 3 total).
    const sources = [sourceDataUri, ...attachmentDataUris].slice(0, 3);
    const result = await editImage(plan.prompt, sources, aspectRatio);
    const url = result.dataUri ? await saveDataUri(result.dataUri) : await saveRemote(result.url!);

    const gen = createGeneration({
      brand_id: brandId,
      batch_id: nanoid(10),
      instruction: `Refine: ${instruction}`,
      final_prompt: plan.prompt,
      agent_notes: plan.rationale,
      refs: JSON.stringify({ refine_of: imageUrl, context: contextLabel }),
      url,
      aspect_ratio: aspectRatio,
      status: "done",
      error: null,
    });

    return NextResponse.json(gen);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
