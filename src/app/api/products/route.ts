import { NextRequest, NextResponse } from "next/server";
import { listProducts, productImages, createProduct, addProductImage } from "@/lib/repo";
import { uniqueHandle, toHandle } from "@/lib/slug";
import { saveDataUri, saveRemote, dataUriToModelDataUri } from "@/lib/storage";
import { generateImage } from "@/lib/xai";
import { describeSubject, PHOTOREALISM } from "@/lib/agent";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  if (!brand) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const products = listProducts(brand).map((p) => ({ ...p, images: productImages(p.id) }));
  return NextResponse.json(products);
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
      const aspectRatio: string = body.aspectRatio || "1:1";
      if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
      const img = await generateImage(
        `Photograph a high-end fashion product packshot: ${prompt}. Product centered on a clean seamless studio background, three-point softbox setup with soft realistic reflections and gentle shadow. Shot on a Canon EOS R5 with a 100mm f/2.8 macro lens for crisp material and texture detail (visible fabric weave, stitching, hardware), true-to-life neutral color. ${PHOTOREALISM}`,
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
          description = await describeSubject("product", sample);
        } catch {
          description = "";
        }
      }
    }

    const handle = uniqueHandle("products", brandId, name ? toHandle(name) : "product");
    const product = createProduct(brandId, handle, description);
    savedUrls.forEach((url, i) => addProductImage(product.id, url, labels[i] ?? (i === 0 ? "primary" : "source"), i === 0));

    return NextResponse.json({ ...product, images: productImages(product.id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
