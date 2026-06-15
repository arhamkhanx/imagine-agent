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
