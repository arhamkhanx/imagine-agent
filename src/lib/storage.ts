import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import sharp from "sharp";

// xAI image models accept JPG/PNG/WebP/ICO only (not GIF/AVIF/HEIC/SVG), so we
// transcode everything bound for a model to a safe, reasonably-sized JPEG.
const MODEL_MAX_DIM = 1536;

async function bufferToModelJpeg(buf: Buffer): Promise<string> {
  const meta = await sharp(buf, { failOn: "none" }).metadata();
  const maxDim = Math.max(meta.width ?? 0, meta.height ?? 0) || 1;
  // Cap large images; upscale tiny ones so they meet the model's minimum size.
  const target = maxDim < 256 ? 512 : MODEL_MAX_DIM;
  const out = await sharp(buf, { failOn: "none", animated: false })
    .rotate()
    .resize({ width: target, height: target, fit: "inside", withoutEnlargement: maxDim >= 256 })
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

/** Read a stored public image and return a model-safe JPEG data URI. */
export async function urlToModelDataUri(publicPath: string): Promise<string> {
  const rel = publicPath.replace(/^\//, "");
  const abs = path.join(process.cwd(), "public", rel);
  return bufferToModelJpeg(await readFile(abs));
}

/** Convert any incoming base64 data URI into a model-safe JPEG data URI. */
export async function dataUriToModelDataUri(dataUri: string): Promise<string> {
  const m = /^data:.+?;base64,([\s\S]*)$/.exec(dataUri);
  if (!m) return dataUri;
  return bufferToModelJpeg(Buffer.from(m[1], "base64"));
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/** Persist raw bytes to public/uploads and return the public URL path. */
export async function saveBuffer(buf: Buffer, mime = "image/jpeg"): Promise<string> {
  const name = `${nanoid()}.${extFromMime(mime)}`;
  await writeFile(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/** Persist a base64 data URI (data:image/...;base64,xxx) and return the public URL path. */
export async function saveDataUri(dataUri: string): Promise<string> {
  const match = /^data:(.+?);base64,(.*)$/s.exec(dataUri);
  if (!match) throw new Error("Invalid data URI");
  const [, mime, b64] = match;
  return saveBuffer(Buffer.from(b64, "base64"), mime);
}

/** Download a remote image URL and persist it locally. */
export async function saveRemote(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return saveBuffer(buf, mime);
}

/** Read a previously-saved public URL path back into a base64 data URI for the model. */
export async function urlToDataUri(publicPath: string): Promise<string> {
  const rel = publicPath.replace(/^\//, "");
  const abs = path.join(process.cwd(), "public", rel);
  const buf = await readFile(abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}
