"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useBrand } from "@/components/BrandContext";
import { api } from "@/lib/client";

type Item = { id: string; url: string };
type Board = { id: string; name: string; description: string; items: Item[] };

export default function MoodboardsPage() {
  const { current } = useBrand();
  const [boards, setBoards] = useState<Board[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    setBoards(await api<Board[]>(`/api/moodboards?brand=${current.id}`));
  }, [current]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!current) return;
    const b = await api<Board>("/api/moodboards", {
      method: "POST",
      body: JSON.stringify({ brandId: current.id, name }),
    });
    setName("");
    setCreating(false);
    load();
    window.location.href = `/moodboards/${b.id}`;
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Moodboards</h1>
          <p style={{ color: "var(--muted)" }} className="text-sm mt-1">
            Drop your aesthetic references on a canvas. Everything saves automatically and is used to
            steer your generations.
          </p>
        </div>
        <button className="btn" onClick={() => setCreating((v) => !v)} disabled={!current}>
          {creating ? "Close" : "New moodboard"}
        </button>
      </div>

      {creating && (
        <div className="card p-5 mb-6 flex gap-2 max-w-md">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. soft_minimal_ss26" />
          <button className="btn" onClick={create}>
            Create
          </button>
        </div>
      )}

      {boards.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No moodboards yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {boards.map((b) => (
            <div key={b.id} className="card overflow-hidden relative group">
              <Link href={`/moodboards/${b.id}`} className="block">
                <div className="grid grid-cols-3 gap-0.5 aspect-video" style={{ background: "var(--bg-deep)" }}>
                  {b.items.slice(0, 6).map((it) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={it.id} src={it.url} alt="" className="w-full h-full object-cover" />
                  ))}
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="tag">@{b.name}</div>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {b.items.length} image{b.items.length === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
              <button
                className="btn-danger absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
                style={{ padding: "5px 11px", fontSize: 11 }}
                onClick={async (e) => {
                  e.preventDefault();
                  if (!confirm(`Delete moodboard @${b.name}?`)) return;
                  await api(`/api/moodboards/${b.id}`, { method: "DELETE" });
                  load();
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
