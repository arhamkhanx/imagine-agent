import { db } from "./db";
import { nanoid } from "nanoid";

export type Brand = { id: string; name: string; created_at: number };
export type Img = { id: string; url: string; label: string; is_primary: number; created_at: number };
export type Face = { id: string; brand_id: string; name: string; description: string; created_at: number };
export type Product = Face;
export type Moodboard = {
  id: string;
  brand_id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
};
export type MoodboardItem = {
  id: string;
  moodboard_id: string;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  created_at: number;
};
export type Generation = {
  id: string;
  brand_id: string;
  batch_id: string;
  instruction: string;
  final_prompt: string;
  agent_notes: string;
  refs: string;
  url: string | null;
  aspect_ratio: string;
  status: string;
  error: string | null;
  created_at: number;
};

// ---- Image versions (asset journey) ----
export type AssetType = "face_image" | "product_image" | "moodboard_item" | "generation";
export type Version = {
  id: string;
  asset_type: AssetType;
  asset_id: string;
  url: string;
  note: string;
  seq: number;
  created_at: number;
};

export const listVersions = (type: AssetType, assetId: string) =>
  db
    .prepare("SELECT * FROM image_versions WHERE asset_type = ? AND asset_id = ? ORDER BY seq ASC")
    .all(type, assetId) as Version[];

export function addVersion(type: AssetType, assetId: string, url: string, note: string): Version {
  const max = db
    .prepare("SELECT COALESCE(MAX(seq), 0) AS m FROM image_versions WHERE asset_type = ? AND asset_id = ?")
    .get(type, assetId) as { m: number };
  const v: Version = {
    id: nanoid(12),
    asset_type: type,
    asset_id: assetId,
    url,
    note,
    seq: max.m + 1,
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO image_versions (id, asset_type, asset_id, url, note, seq, created_at) VALUES (@id, @asset_type, @asset_id, @url, @note, @seq, @created_at)"
  ).run(v);
  return v;
}

/** Update the displayed url of an asset (latest version replaces it). */
export function setAssetUrl(type: AssetType, assetId: string, url: string) {
  const table =
    type === "face_image"
      ? "face_images"
      : type === "product_image"
      ? "product_images"
      : type === "moodboard_item"
      ? "moodboard_items"
      : "generations";
  db.prepare(`UPDATE ${table} SET url = ? WHERE id = ?`).run(url, assetId);
}

// ---- Brands ----
export const listBrands = () =>
  db.prepare("SELECT * FROM brands ORDER BY created_at ASC").all() as Brand[];
export const getBrand = (id: string) =>
  db.prepare("SELECT * FROM brands WHERE id = ?").get(id) as Brand | undefined;
export function createBrand(name: string): Brand {
  const b: Brand = { id: nanoid(8), name, created_at: Date.now() };
  db.prepare("INSERT INTO brands (id, name, created_at) VALUES (?, ?, ?)").run(b.id, b.name, b.created_at);
  return b;
}
export const updateBrand = (id: string, name: string) =>
  db.prepare("UPDATE brands SET name = ? WHERE id = ?").run(name, id);
export const deleteBrand = (id: string) => db.prepare("DELETE FROM brands WHERE id = ?").run(id);
export const brandCount = () => (db.prepare("SELECT COUNT(*) AS c FROM brands").get() as { c: number }).c;

// ---- Faces ----
export const listFaces = (brandId: string) =>
  db.prepare("SELECT * FROM faces WHERE brand_id = ? ORDER BY created_at DESC").all(brandId) as Face[];
export const getFace = (id: string) =>
  db.prepare("SELECT * FROM faces WHERE id = ?").get(id) as Face | undefined;
export function createFace(brandId: string, name: string, description: string): Face {
  const f: Face = { id: nanoid(10), brand_id: brandId, name, description, created_at: Date.now() };
  db.prepare(
    "INSERT INTO faces (id, brand_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(f.id, f.brand_id, f.name, f.description, f.created_at);
  return f;
}
export const updateFace = (id: string, name: string, description: string) =>
  db.prepare("UPDATE faces SET name = ?, description = ? WHERE id = ?").run(name, description, id);
export const deleteFace = (id: string) => db.prepare("DELETE FROM faces WHERE id = ?").run(id);
export const faceImages = (faceId: string) =>
  db
    .prepare("SELECT * FROM face_images WHERE face_id = ? ORDER BY is_primary DESC, created_at ASC")
    .all(faceId) as Img[];
export function addFaceImage(faceId: string, url: string, label: string, isPrimary = false): Img {
  const img: Img = { id: nanoid(10), url, label, is_primary: isPrimary ? 1 : 0, created_at: Date.now() };
  db.prepare(
    "INSERT INTO face_images (id, face_id, url, label, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(img.id, faceId, img.url, img.label, img.is_primary, img.created_at);
  addVersion("face_image", img.id, url, "original");
  return img;
}
export const getFaceImage = (id: string) =>
  db.prepare("SELECT * FROM face_images WHERE id = ?").get(id) as
    | (Img & { face_id: string })
    | undefined;
export const deleteFaceImage = (id: string) =>
  db.prepare("DELETE FROM face_images WHERE id = ?").run(id);
export function setFacePrimary(faceId: string, imageId: string) {
  const tx = db.transaction(() => {
    db.prepare("UPDATE face_images SET is_primary = 0 WHERE face_id = ?").run(faceId);
    db.prepare("UPDATE face_images SET is_primary = 1 WHERE id = ?").run(imageId);
  });
  tx();
}

// ---- Products ----
export const listProducts = (brandId: string) =>
  db.prepare("SELECT * FROM products WHERE brand_id = ? ORDER BY created_at DESC").all(brandId) as Product[];
export const getProduct = (id: string) =>
  db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Product | undefined;
export function createProduct(brandId: string, name: string, description: string): Product {
  const p: Product = { id: nanoid(10), brand_id: brandId, name, description, created_at: Date.now() };
  db.prepare(
    "INSERT INTO products (id, brand_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(p.id, p.brand_id, p.name, p.description, p.created_at);
  return p;
}
export const updateProduct = (id: string, name: string, description: string) =>
  db.prepare("UPDATE products SET name = ?, description = ? WHERE id = ?").run(name, description, id);
export const deleteProduct = (id: string) => db.prepare("DELETE FROM products WHERE id = ?").run(id);
export const productImages = (productId: string) =>
  db
    .prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, created_at ASC")
    .all(productId) as Img[];
export function addProductImage(productId: string, url: string, label: string, isPrimary = false): Img {
  const img: Img = { id: nanoid(10), url, label, is_primary: isPrimary ? 1 : 0, created_at: Date.now() };
  db.prepare(
    "INSERT INTO product_images (id, product_id, url, label, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(img.id, productId, img.url, img.label, img.is_primary, img.created_at);
  addVersion("product_image", img.id, url, "original");
  return img;
}
export const getProductImage = (id: string) =>
  db.prepare("SELECT * FROM product_images WHERE id = ?").get(id) as
    | (Img & { product_id: string })
    | undefined;
export const deleteProductImage = (id: string) =>
  db.prepare("DELETE FROM product_images WHERE id = ?").run(id);
export function setProductPrimary(productId: string, imageId: string) {
  const tx = db.transaction(() => {
    db.prepare("UPDATE product_images SET is_primary = 0 WHERE product_id = ?").run(productId);
    db.prepare("UPDATE product_images SET is_primary = 1 WHERE id = ?").run(imageId);
  });
  tx();
}

// ---- Moodboards ----
export const listMoodboards = (brandId: string) =>
  db.prepare("SELECT * FROM moodboards WHERE brand_id = ? ORDER BY created_at DESC").all(brandId) as Moodboard[];
export const getMoodboard = (id: string) =>
  db.prepare("SELECT * FROM moodboards WHERE id = ?").get(id) as Moodboard | undefined;
export function createMoodboard(brandId: string, name: string): Moodboard {
  const now = Date.now();
  const m: Moodboard = { id: nanoid(10), brand_id: brandId, name, description: "", created_at: now, updated_at: now };
  db.prepare(
    "INSERT INTO moodboards (id, brand_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(m.id, m.brand_id, m.name, m.description, m.created_at, m.updated_at);
  return m;
}
export const updateMoodboardMeta = (id: string, name: string, description: string) =>
  db
    .prepare("UPDATE moodboards SET name = ?, description = ?, updated_at = ? WHERE id = ?")
    .run(name, description, Date.now(), id);
export const deleteMoodboard = (id: string) => db.prepare("DELETE FROM moodboards WHERE id = ?").run(id);
export const moodboardItems = (moodboardId: string) =>
  db.prepare("SELECT * FROM moodboard_items WHERE moodboard_id = ? ORDER BY z ASC").all(moodboardId) as MoodboardItem[];
export function addMoodboardItem(
  moodboardId: string,
  url: string,
  pos: { x: number; y: number; w: number; h: number; z: number }
): MoodboardItem {
  const it: MoodboardItem = { id: nanoid(10), moodboard_id: moodboardId, url, ...pos, created_at: Date.now() };
  db.prepare(
    "INSERT INTO moodboard_items (id, moodboard_id, url, x, y, w, h, z, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(it.id, moodboardId, it.url, it.x, it.y, it.w, it.h, it.z, it.created_at);
  addVersion("moodboard_item", it.id, url, "original");
  return it;
}
export const getMoodboardItem = (id: string) =>
  db.prepare("SELECT * FROM moodboard_items WHERE id = ?").get(id) as MoodboardItem | undefined;
export const updateMoodboardItem = (
  id: string,
  pos: { x: number; y: number; w: number; h: number; z: number }
) =>
  db
    .prepare("UPDATE moodboard_items SET x = ?, y = ?, w = ?, h = ?, z = ? WHERE id = ?")
    .run(pos.x, pos.y, pos.w, pos.h, pos.z, id);
export const deleteMoodboardItem = (id: string) =>
  db.prepare("DELETE FROM moodboard_items WHERE id = ?").run(id);

// ---- Generations ----
export const listGenerations = (brandId: string) =>
  db.prepare("SELECT * FROM generations WHERE brand_id = ? ORDER BY created_at DESC LIMIT 100").all(brandId) as Generation[];
export const getGeneration = (id: string) =>
  db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as Generation | undefined;
export const deleteGeneration = (id: string) =>
  db.prepare("DELETE FROM generations WHERE id = ?").run(id);
export function createGeneration(g: Omit<Generation, "id" | "created_at">): Generation {
  const full: Generation = { ...g, id: nanoid(12), created_at: Date.now() };
  db.prepare(
    `INSERT INTO generations (id, brand_id, batch_id, instruction, final_prompt, agent_notes, refs, url, aspect_ratio, status, error, created_at)
     VALUES (@id, @brand_id, @batch_id, @instruction, @final_prompt, @agent_notes, @refs, @url, @aspect_ratio, @status, @error, @created_at)`
  ).run(full);
  if (full.url) addVersion("generation", full.id, full.url, "generated");
  return full;
}
