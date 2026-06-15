import { NextRequest, NextResponse } from "next/server";
import { createGeneration, addVersion, setAssetUrl, listVersions, type AssetType } from "@/lib/repo";
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
      assetType,
      assetId,
    } = (await req.json()) as {
      brandId: string;
      imageUrl: string;
      instruction: string;
      attachments?: string[];
      contextLabel?: string;
      aspectRatio?: string;
      assetType?: AssetType;
      assetId?: string;
    };

    if (!brandId || !imageUrl || !instruction?.trim()) {
      return NextResponse.json({ error: "brandId, imageUrl and instruction required" }, { status: 400 });
    }

    const sourceDataUri = await urlToModelDataUri(imageUrl);
    const attachmentDataUris = await Promise.all(
      (attachments || []).slice(0, 2).map((a) => dataUriToModelDataUri(a))
    );

    const plan = await planRefinement({ instruction, contextLabel, sourceDataUri, attachmentDataUris });

    const sources = [sourceDataUri, ...attachmentDataUris].slice(0, 3);
    const result = await editImage(plan.prompt, sources, aspectRatio);
    const url = result.dataUri ? await saveDataUri(result.dataUri) : await saveRemote(result.url!);

    // If this edit targets a known asset, append a version and replace the displayed image.
    if (assetType && assetId) {
      addVersion(assetType, assetId, url, instruction);
      setAssetUrl(assetType, assetId, url);
      return NextResponse.json({
        url,
        prompt: plan.prompt,
        rationale: plan.rationale,
        assetType,
        assetId,
        versions: listVersions(assetType, assetId),
      });
    }

    // Otherwise create a standalone generation (its own asset journey).
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
    return NextResponse.json({
      url,
      prompt: plan.prompt,
      rationale: plan.rationale,
      assetType: "generation",
      assetId: gen.id,
      versions: listVersions("generation", gen.id),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
