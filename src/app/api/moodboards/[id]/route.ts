import { NextRequest, NextResponse } from "next/server";
import {
  getMoodboard,
  moodboardItems,
  updateMoodboardMeta,
  deleteMoodboard,
  addMoodboardItem,
  updateMoodboardItem,
  deleteMoodboardItem,
} from "@/lib/repo";
import { uniqueHandle } from "@/lib/slug";
import { saveDataUri, urlToModelDataUri } from "@/lib/storage";
import { describeMoodboard } from "@/lib/agent";

type IncomingItem = {
  id?: string;
  url?: string;
  dataUri?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const board = getMoodboard(id);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ...board, items: moodboardItems(id) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const board = getMoodboard(id);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });

    const body = (await req.json()) as {
      name?: string;
      items?: IncomingItem[];
      regenerate?: boolean;
    };

    if (Array.isArray(body.items)) {
      const existing = moodboardItems(id);
      const keptIds = new Set(body.items.filter((i) => i.id).map((i) => i.id!));
      // Delete removed items.
      for (const ex of existing) if (!keptIds.has(ex.id)) deleteMoodboardItem(ex.id);
      // Add new + update existing.
      for (const it of body.items) {
        const pos = { x: it.x, y: it.y, w: it.w, h: it.h, z: it.z };
        if (it.id) {
          updateMoodboardItem(it.id, pos);
        } else if (it.dataUri) {
          const url = await saveDataUri(it.dataUri);
          addMoodboardItem(id, url, pos);
        }
      }
    }

    let description = board.description;
    let warning: string | undefined;
    const name = body.name ? uniqueHandle("moodboards", board.brand_id, body.name, id) : board.name;

    // Silently (re)generate the hidden aesthetic brief from current images.
    if (body.regenerate !== false) {
      const items = moodboardItems(id);
      if (items.length > 0) {
        try {
          const dataUris = await Promise.all(items.slice(0, 8).map((it) => urlToModelDataUri(it.url)));
          description = await describeMoodboard(dataUris);
        } catch (e) {
          // Never block the save — keep the prior brief and report softly.
          warning = (e as Error).message;
        }
      } else {
        description = "";
      }
    }

    updateMoodboardMeta(id, name, description);
    return NextResponse.json({ ...getMoodboard(id), items: moodboardItems(id), warning });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteMoodboard(id);
  return NextResponse.json({ ok: true });
}
