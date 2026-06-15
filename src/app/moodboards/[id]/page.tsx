"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, fileToDataUri } from "@/lib/client";
import { useBrand } from "@/components/BrandContext";
import Modal, { ModalHeader } from "@/components/Modal";
import RefinePanel from "@/components/RefinePanel";

type CanvasItem = {
  key: string;
  id?: string; // server id (existing)
  url?: string; // existing public url
  dataUri?: string; // new upload
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

type Board = {
  id: string;
  name: string;
  description: string;
  items: { id: string; url: string; x: number; y: number; w: number; h: number; z: number }[];
};

type SaveStatus = "saved" | "saving" | "idle";

export default function MoodboardEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { current } = useBrand();
  const id = params.id;

  const [name, setName] = useState("");
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [maxZ, setMaxZ] = useState(1);
  const [refineItem, setRefineItem] = useState<CanvasItem | null>(null);

  // Refs so the debounced saver always reads the latest values.
  const itemsRef = useRef<CanvasItem[]>([]);
  const nameRef = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRegen = useRef(false);
  const saving = useRef(false);
  itemsRef.current = items;
  nameRef.current = name;

  const load = useCallback(async () => {
    const b = await api<Board>(`/api/moodboards/${id}`);
    setName(b.name);
    setItems(
      b.items.map((it, i) => ({
        key: it.id,
        id: it.id,
        url: it.url,
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        z: it.z || i + 1,
      }))
    );
    setMaxZ(b.items.length + 1);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const doSave = useCallback(async () => {
    if (saving.current) {
      // A save is in flight; reschedule shortly after.
      scheduleSave(false);
      return;
    }
    saving.current = true;
    setStatus("saving");
    const regenerate = pendingRegen.current;
    pendingRegen.current = false;
    try {
      const payload = {
        name: nameRef.current,
        items: itemsRef.current.map((it) => ({
          id: it.id,
          dataUri: it.id ? undefined : it.dataUri,
          x: Math.round(it.x),
          y: Math.round(it.y),
          w: Math.round(it.w),
          h: Math.round(it.h),
          z: it.z,
        })),
        regenerate,
      };
      const b = await api<Board>(`/api/moodboards/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      // Reconcile so newly-added items receive their server ids (prevents dupes).
      setItems((prev) => {
        const byId = new Map(b.items.map((s) => [s.id, s]));
        // Match server items to local ones positionally for those lacking ids.
        const serverList = [...b.items];
        return prev.map((local) => {
          if (local.id && byId.has(local.id)) {
            const s = byId.get(local.id)!;
            return { ...local, url: s.url };
          }
          // local was new (no id) — claim the next unmatched server item with same url? fallback: take by order
          const idx = serverList.findIndex((s) => !prev.some((p) => p.id === s.id));
          if (idx >= 0) {
            const s = serverList.splice(idx, 1)[0];
            return { ...local, id: s.id, url: s.url, dataUri: undefined };
          }
          return local;
        });
      });
      setStatus("saved");
    } catch {
      setStatus("idle");
    } finally {
      saving.current = false;
    }
  }, [id]);

  const scheduleSave = useCallback(
    (regen: boolean) => {
      if (regen) pendingRegen.current = true;
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(doSave, 700);
    },
    [doSave]
  );

  const addFiles = async (files: File[]) => {
    const next: CanvasItem[] = [];
    let z = maxZ;
    for (let i = 0; i < files.length; i++) {
      const dataUri = await fileToDataUri(files[i]);
      z += 1;
      next.push({
        key: `new_${Date.now()}_${i}`,
        dataUri,
        x: 40 + ((items.length + i) % 5) * 40,
        y: 40 + ((items.length + i) % 5) * 40,
        w: 220,
        h: 220,
        z,
      });
    }
    setMaxZ(z);
    setItems((prev) => [...prev, ...next]);
    scheduleSave(true); // content changed → refresh hidden brief
  };

  const bringToFront = (key: string) => {
    setMaxZ((z) => {
      const nz = z + 1;
      setItems((prev) => prev.map((it) => (it.key === key ? { ...it, z: nz } : it)));
      return nz;
    });
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
    scheduleSave(true); // content changed → refresh hidden brief
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border-b flex-wrap" style={{ borderColor: "var(--border)" }}>
        <button className="btn-ghost" style={{ padding: "8px 12px" }} onClick={() => router.push("/moodboards")}>
          ← Back
        </button>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            scheduleSave(false);
          }}
          className="flex-1 min-w-[140px] max-w-xs"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <label className="btn-ghost" style={{ padding: "8px 12px" }}>
          + Add
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        <span className="text-xs md:text-sm w-full md:w-auto md:ml-auto flex items-center gap-2" style={{ color: "var(--muted)" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: status === "saved" ? "#5ad17f" : status === "saving" ? "#e8c45a" : "#ff8a9b",
            }}
          />
          {status === "saved" ? "All changes saved" : status === "saving" ? "Saving…" : "Will retry…"}
        </span>
      </div>

      <Canvas
        items={items}
        setItems={setItems}
        onFront={bringToFront}
        onRemove={removeItem}
        onDropFiles={addFiles}
        onReposition={() => scheduleSave(false)}
        onRefine={(it) => setRefineItem(it)}
      />

      <Modal open={!!refineItem} onClose={() => setRefineItem(null)} width={1040}>
        {refineItem?.id && refineItem.url && current && (
          <>
            <ModalHeader title="Refine moodboard image" subtitle="Agent edits with your comments & samples" onClose={() => setRefineItem(null)} />
            <RefinePanel
              brandId={current.id}
              sourceUrl={refineItem.url}
              contextLabel="an image on a fashion moodboard"
              asset={{ type: "moodboard_item", id: refineItem.id }}
              allowFork={false}
              onUpdated={() => {
                load();
                scheduleSave(true);
              }}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

function Canvas({
  items,
  setItems,
  onFront,
  onRemove,
  onDropFiles,
  onReposition,
  onRefine,
}: {
  items: CanvasItem[];
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  onFront: (key: string) => void;
  onRemove: (key: string) => void;
  onDropFiles: (files: File[]) => void;
  onReposition: () => void;
  onRefine: (it: CanvasItem) => void;
}) {
  const drag = useRef<{ key: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent, it: CanvasItem, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    onFront(it.key);
    drag.current = { key: it.key, mode, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, ow: it.w, oh: it.h, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== d.key) return it;
        if (d.mode === "move") return { ...it, x: Math.max(0, d.ox + dx), y: Math.max(0, d.oy + dy) };
        return { ...it, w: Math.max(80, d.ow + dx), h: Math.max(80, d.oh + dy) };
      })
    );
  };

  const onPointerUp = () => {
    if (drag.current?.moved) onReposition();
    drag.current = null;
  };

  return (
    <div
      className="flex-1 relative overflow-auto"
      style={{ background: "repeating-conic-gradient(#0f0f11 0% 25%, #121214 0% 50%) 50% / 28px 28px" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        if (files.length) onDropFiles(files);
      }}
    >
      {items.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p style={{ color: "var(--muted)" }}>Drag & drop images here, or use “Add images”. Everything saves automatically.</p>
        </div>
      )}
      {items.map((it) => (
        <div
          key={it.key}
          className="absolute group rounded-lg overflow-hidden shadow-lg"
          style={{ left: it.x, top: it.y, width: it.w, height: it.h, zIndex: it.z, border: "1px solid var(--border)" }}
          onPointerDown={(e) => onPointerDown(e, it, "move")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.url ?? it.dataUri} alt="" draggable={false} className="w-full h-full object-cover select-none pointer-events-none" />
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(it.key)}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"
            style={{ background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 12, border: "none" }}
          >
            ✕
          </button>
          {it.id && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRefine(it)}
              className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 12, border: "none" }}
              title="Refine with agent"
            >
              ✎
            </button>
          )}
          <div
            onPointerDown={(e) => onPointerDown(e, it, "resize")}
            className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100"
            style={{ width: 16, height: 16, cursor: "nwse-resize", background: "var(--accent)", borderTopLeftRadius: 6 }}
          />
        </div>
      ))}
    </div>
  );
}
