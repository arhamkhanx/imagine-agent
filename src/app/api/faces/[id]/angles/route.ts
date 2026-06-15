import { NextRequest, NextResponse } from "next/server";
import { getFace, faceImages, addFaceImage } from "@/lib/repo";
import { urlToModelDataUri, saveDataUri, saveRemote } from "@/lib/storage";
import { editImage } from "@/lib/xai";
import { PHOTOREALISM } from "@/lib/agent";
import { MAX_SUBJECT_IMAGES } from "@/lib/limits";

const ANGLE_PROMPTS: Record<string, string> = {
  front: "front-facing view, looking directly at the camera",
  three_quarter_left: "three-quarter view turned slightly to the left",
  three_quarter_right: "three-quarter view turned slightly to the right",
  left_profile: "left side profile view",
  right_profile: "right side profile view",
  looking_up: "head tilted slightly upward, three-quarter angle",
  looking_down: "head tilted slightly downward, contemplative",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const face = getFace(id);
    if (!face) return NextResponse.json({ error: "not found" }, { status: 404 });

    const { angles } = (await req.json()) as { angles: string[] };
    const imgs = faceImages(id);
    const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
    if (!primary) return NextResponse.json({ error: "face has no source image" }, { status: 400 });

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
        `Keep this exact same person — identical face, bone structure, skin tone, hair and distinguishing features. Re-photograph them from a different angle: ${desc}. Maintain the same neutral studio backdrop, soft octabox lighting, lens and color grade for a consistent set. Visible natural skin texture and pores, shallow depth of field. ${PHOTOREALISM}`,
        [sourceDataUri],
        "2:3"
      );
      const url = img.dataUri ? await saveDataUri(img.dataUri) : await saveRemote(img.url!);
      created.push(addFaceImage(id, url, angle, false));
    }
    return NextResponse.json({
      images: faceImages(id),
      created,
      skipped: angles.length - toGenerate.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
