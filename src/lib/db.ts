import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "imagine-agent.db");

// Reuse the connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __imagineAgentDb?: Database.Database };

function init(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS faces (
      id TEXT PRIMARY KEY,
      brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      UNIQUE (brand_id, name)
    );

    CREATE TABLE IF NOT EXISTS face_images (
      id TEXT PRIMARY KEY,
      face_id TEXT NOT NULL REFERENCES faces(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT 'source',
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      UNIQUE (brand_id, name)
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT 'source',
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS moodboards (
      id TEXT PRIMARY KEY,
      brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (brand_id, name)
    );

    CREATE TABLE IF NOT EXISTS moodboard_items (
      id TEXT PRIMARY KEY,
      moodboard_id TEXT NOT NULL REFERENCES moodboards(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      w REAL NOT NULL DEFAULT 220,
      h REAL NOT NULL DEFAULT 220,
      z INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      batch_id TEXT NOT NULL DEFAULT '',
      instruction TEXT NOT NULL,
      final_prompt TEXT NOT NULL DEFAULT '',
      agent_notes TEXT NOT NULL DEFAULT '',
      refs TEXT NOT NULL DEFAULT '{}',
      url TEXT,
      aspect_ratio TEXT NOT NULL DEFAULT '1:1',
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Migration: add batch_id to pre-existing generations tables.
  const genCols = db.prepare("PRAGMA table_info(generations)").all() as { name: string }[];
  if (!genCols.some((c) => c.name === "batch_id")) {
    db.exec("ALTER TABLE generations ADD COLUMN batch_id TEXT NOT NULL DEFAULT ''");
  }

  // Version history (image journey) for every image asset.
  db.exec(`
    CREATE TABLE IF NOT EXISTS image_versions (
      id TEXT PRIMARY KEY,
      asset_type TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      url TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      seq INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_versions_asset ON image_versions (asset_type, asset_id, seq);
  `);

  // Seed an initial version for any pre-existing asset that has none.
  const seed = (table: string, type: string, note: string, whereUrl = "") =>
    db.exec(`
      INSERT INTO image_versions (id, asset_type, asset_id, url, note, seq, created_at)
      SELECT lower(hex(randomblob(8))), '${type}', t.id, t.url, '${note}', 1, t.created_at
      FROM ${table} t
      WHERE ${whereUrl} NOT EXISTS (
        SELECT 1 FROM image_versions v WHERE v.asset_type = '${type}' AND v.asset_id = t.id
      );
    `);
  seed("face_images", "face_image", "original");
  seed("product_images", "product_image", "original");
  seed("moodboard_items", "moodboard_item", "original");
  seed("generations", "generation", "generated", "t.url IS NOT NULL AND");

  // Seed a default brand if none exists.
  const count = db.prepare("SELECT COUNT(*) AS c FROM brands").get() as { c: number };
  if (count.c === 0) {
    db.prepare("INSERT INTO brands (id, name, created_at) VALUES (?, ?, ?)").run(
      "default",
      "My Brand",
      Date.now()
    );
  }

  return db;
}

export const db: Database.Database = globalForDb.__imagineAgentDb ?? init();
if (process.env.NODE_ENV !== "production") globalForDb.__imagineAgentDb = db;
