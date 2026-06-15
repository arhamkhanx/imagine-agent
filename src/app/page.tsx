"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBrand } from "@/components/BrandContext";
import { api, ASPECT_RATIOS } from "@/lib/client";
import Modal, { ModalHeader } from "@/components/Modal";
import RefinePanel from "@/components/RefinePanel";
import MentionInput, { type MentionInputHandle } from "@/components/MentionInput";

type Img = { id: string; url: string; is_primary: number };
type Subject = { id: string; name: string; description: string; images: Img[] };
type Board = { id: string; name: string; description: string };
type Generation = {
  id: string;
  batch_id: string;
  instruction: string;
  final_prompt: string;
  agent_notes: string;
  url: string | null;
  aspect_ratio: string;
  refs: string;
};

function groupByBatch(gens: Generation[]): Generation[][] {
  const map = new Map<string, Generation[]>();
  const order: string[] = [];
  for (const g of gens) {
    const key = g.batch_id || g.id;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(g);
  }
  return order.map((k) => map.get(k)!);
}

type Mention = { handle: string; type: "face" | "product" | "moodboard"; thumb?: string };

export default function Studio() {
  const { current } = useBrand();
  const [faces, setFaces] = useState<Subject[]>([]);
  const [products, setProducts] = useState<Subject[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [history, setHistory] = useState<Generation[]>([]);

  const [text, setText] = useState("");
  const [aspect, setAspect] = useState("4:3");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<Generation[]>([]);

  const mentionRef = useRef<MentionInputHandle>(null);

  const load = useCallback(async () => {
    if (!current) return;
    const [f, p, b, h] = await Promise.all([
      api<Subject[]>(`/api/faces?brand=${current.id}`),
      api<Subject[]>(`/api/products?brand=${current.id}`),
      api<Board[]>(`/api/moodboards?brand=${current.id}`),
      api<Generation[]>(`/api/generations?brand=${current.id}`),
    ]);
    setFaces(f);
    setProducts(p);
    setBoards(b);
    setHistory(h);
  }, [current]);

  useEffect(() => {
    load();
  }, [load]);

  const allMentions: Mention[] = useMemo(
    () => [
      ...faces.map((f) => ({ handle: f.name, type: "face" as const, thumb: (f.images.find((i) => i.is_primary) ?? f.images[0])?.url })),
      ...products.map((p) => ({ handle: p.name, type: "product" as const, thumb: (p.images.find((i) => i.is_primary) ?? p.images[0])?.url })),
      ...boards.map((b) => ({ handle: b.name, type: "moodboard" as const })),
    ],
    [faces, products, boards]
  );

  const generate = async () => {
    if (!current || !text.trim()) return;
    setBusy(true);
    setError("");
    setLatest([]);
    try {
      const gens = await api<Generation[]>("/api/generate", {
        method: "POST",
        body: JSON.stringify({ brandId: current.id, instruction: text, aspectRatio: aspect, count }),
      });
      setLatest(gens);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">Studio</h1>
      <p style={{ color: "var(--muted)" }} className="text-sm mt-1 mb-6">
        Describe what you want. Reference your library with <span className="tag">@handle</span>. An agent
        analyzes your model, product and moodboard, then writes the optimal prompt and renders at maximum
        quality.
      </p>

      <div className="card p-5 mb-6">
        <MentionInput
          ref={mentionRef}
          value={text}
          onChange={setText}
          mentions={allMentions}
          onSubmit={generate}
          placeholder="e.g. generate an image of @anna_studio wearing @linen_blazer in the style of @soft_minimal_ss26"
        />

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="label" style={{ margin: 0 }}>
              Aspect
            </span>
            <select value={aspect} onChange={(e) => setAspect(e.target.value)} style={{ width: 110 }}>
              {ASPECT_RATIOS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="label" style={{ margin: 0 }}>
              Variants
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className="tag"
                  style={{
                    background: count === n ? "var(--accent)" : "var(--panel-2)",
                    color: count === n ? "#0a0a0b" : "var(--accent)",
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button className="btn" onClick={generate} disabled={busy || !text.trim()}>
            {busy ? "Agent working…" : count > 1 ? `Generate ${count}` : "Generate"}
          </button>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Always rendered at 2K, highest quality.
          </span>
        </div>

        {allMentions.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-4">
            {allMentions.map((m) => (
              <button
                key={`${m.type}_${m.handle}`}
                className="tag"
                onClick={() => mentionRef.current?.insert(m.handle)}
                title={m.type}
                style={{ cursor: "pointer" }}
              >
                @{m.handle}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="card p-3 mb-4 text-sm" style={{ color: "#ff8a9b", borderColor: "#5a2a32" }}>
          {error}
        </div>
      )}

      {busy && (
        <div className="card p-6 mb-6 text-center" style={{ color: "var(--muted)" }}>
          The agent is analyzing your references and writing the prompt, then rendering
          {count > 1 ? ` ${count} variants` : ""}…
        </div>
      )}

      {latest.length > 0 && (
        <ResultGroup gens={latest} featured brandId={current?.id ?? ""} onRefined={load} />
      )}

      {history.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-8 mb-3">History</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groupByBatch(history).map((group) => (
              <ResultGroup key={group[0].batch_id || group[0].id} gens={group} brandId={current?.id ?? ""} onRefined={load} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ResultGroup({
  gens,
  featured,
  brandId,
  onRefined,
}: {
  gens: Generation[];
  featured?: boolean;
  brandId: string;
  onRefined: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [refineUrl, setRefineUrl] = useState<string | null>(null);
  const head = gens[0];
  const images = gens.filter((g) => g.url);
  const multi = images.length > 1;

  return (
    <div className={`card overflow-hidden ${featured ? "mb-6" : ""}`}>
      {images.length > 0 && (
        <div className={multi ? "grid grid-cols-2 gap-0.5 bg-black/40" : ""}>
          {images.map((g) => (
            <button
              key={g.id}
              onClick={() => setRefineUrl(g.url!)}
              className="block w-full group relative"
              style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
              title="Click to refine with the agent"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.url!}
                alt={head.instruction}
                className="w-full object-cover bg-black/40"
                style={{ maxHeight: featured ? (multi ? 360 : 560) : multi ? 200 : 320, width: "100%" }}
              />
              <span
                className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition"
                style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
              >
                ✎ Refine
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm flex-1">{head.instruction}</p>
          {multi && <span className="tag shrink-0">{images.length} variants</span>}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs"
          style={{ color: "var(--muted)", background: "transparent", border: "none", padding: 0 }}
        >
          {open ? "Hide" : "Show"} agent prompt & notes
        </button>
        {open && (
          <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            <div className="label" style={{ marginTop: 8 }}>
              Agent rationale
            </div>
            <p className="mb-2">{head.agent_notes}</p>
            <div className="label">Final prompt</div>
            <p className="whitespace-pre-wrap">{head.final_prompt}</p>
          </div>
        )}
      </div>

      <Modal open={!!refineUrl} onClose={() => setRefineUrl(null)} width={1000}>
        {refineUrl && (
          <>
            <ModalHeader title="Refine result" subtitle="The agent edits with your comments & samples" onClose={() => setRefineUrl(null)} />
            <RefinePanel
              brandId={brandId}
              sourceUrl={refineUrl}
              contextLabel={`a generated fashion image. Original brief: ${head.instruction}`}
              onCreatedGeneration={onRefined}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
