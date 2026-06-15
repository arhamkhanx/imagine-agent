import { db } from "./db";

/** Normalize any string into lowercase / underscores / numbers only. */
export function toHandle(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 60);
}

export function isValidHandle(input: string): boolean {
  return /^[a-z0-9_]+$/.test(input) && input.length > 0 && input.length <= 60;
}

/**
 * Ensure a handle is unique within a brand for the given table.
 * Appends _2, _3, ... when needed.
 */
export function uniqueHandle(
  table: "faces" | "products" | "moodboards",
  brandId: string,
  desired: string,
  excludeId?: string
): string {
  const base = toHandle(desired) || table.slice(0, -1);
  let candidate = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const row = db
      .prepare(
        `SELECT id FROM ${table} WHERE brand_id = ? AND name = ? ${
          excludeId ? "AND id != ?" : ""
        }`
      )
      .get(...(excludeId ? [brandId, candidate, excludeId] : [brandId, candidate])) as
      | { id: string }
      | undefined;
    if (!row) return candidate;
    candidate = `${base}_${n++}`;
  }
}
