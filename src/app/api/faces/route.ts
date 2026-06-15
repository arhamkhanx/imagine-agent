import { NextRequest, NextResponse } from "next/server";
import { listFaces, faceImages, createFace, addFaceImage } from "@/lib/repo";
import { uniqueHandle, toHandle } from "@/lib/slug";
import { saveDataUri, saveRemote, dataUriToModelDataUri } from "@/lib/storage";
import { generateImage } from "@/lib/xai";
import { describeSubject, PHOTOREALISM } from "@/lib/agent";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  if (!brand) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const faces = listFaces(brand).map((f) => ({ ...f, images: faceImages(f.id) }));
  return NextResponse.json(faces);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandId, name, mode } = body as {
      brandId: string;
      name?: string;
      mode: "upload" | "generate";
    };
    if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });

    let description: string = (body.description ?? "").trim();
    const savedUrls: string[] = [];
    const labels: string[] = [];

    if (mode === "generate") {
      const prompt: string = body.prompt;
      const aspectRatio: string = body.aspectRatio || "2:3";
      if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
      const img = await generateImage(
        `Photograph a professional fashion model: ${prompt}. Relaxed natural expression, looking directly into the lens, head-and-shoulders to three-quarter framing, centered. Clean seamless neutral studio backdrop. Shot on a Hasselblad medium-format camera with an 80mm f/2.8 lens, soft large octabox key light with gentle fill and natural soft shadows, shallow depth of field. Kodak Portra 400 color science, true-to-life neutral white balance, fine natural film grain. ${PHOTOREALISM}`,
        aspectRatio
      );
      savedUrls.push(img.dataUri ? await saveDataUri(img.dataUri) : await saveRemote(img.url!));
      labels.push("primary");
      if (!description) description = prompt;
    } else {
      // Accept images as plain data URIs or { dataUri, label } objects.
      const raw: Array<string | { dataUri: string; label?: string }> = body.images ?? [];
      const norm = raw.map((x) => (typeof x === "string" ? { dataUri: x, label: "" } : x));
      if (!norm.length) return NextResponse.json({ error: "images required" }, { status: 400 });
      for (let i = 0; i < norm.length; i++) {
        savedUrls.push(await saveDataUri(norm[i].dataUri));
        labels.push(toHandle(norm[i].label ?? "") || (i === 0 ? "primary" : "source"));
      }
      if (!description) {
        try {
          const sample = await Promise.all(norm.slice(0, 2).map((n) => dataUriToModelDataUri(n.dataUri)));
          description = await describeSubject("face", sample);
        } catch {
          description = "";
        }
      }
    }

    const handle = uniqueHandle("faces", brandId, name ? toHandle(name) : "model");
    const face = createFace(brandId, handle, description);
    savedUrls.forEach((url, i) => addFaceImage(face.id, url, labels[i] ?? (i === 0 ? "primary" : "source"), i === 0));

    return NextResponse.json({ ...face, images: faceImages(face.id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
