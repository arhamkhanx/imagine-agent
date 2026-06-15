"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, fileToDataUri } from "@/lib/client";
import { Spinner } from "./Modal";

export type AssetType = "face_image" | "product_image" | "moodboard_item" | "generation";
type Version = { id: string; url: string; note: string; seq: number; created_at: number };
type RefineRes = { url: string; rationale: string; prompt: string; versions: Version[] };

type Msg =
  | { role: "user"; text: string; thumbs: string[] }
  | { role: "agent"; rationale: string; prompt: string; url: string };

export default function RefinePanel({
  brandId,
  sourceUrl,
  contextLabel,
  asset,
  allowFork = true,
  onUpdated,
}: {
  brandId: string;
  sourceUrl: string;
  contextLabel: string;
  asset: { type: AssetType; id: string };
  allowFork?: boolean;
  onUpdated?: () => void;
}) {
  const [thread, setThread] = useState<Msg[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentUrl, setCurrentUrl] = useState(sourceUrl);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadVersions = useCallback(async () => {
    try {
      setVersions(await api<Version[]>(`/api/assets/versions?type=${asset.type}&id=${asset.id}`));
    } catch {
      /* ignore */
    }
  }, [asset.type, asset.id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const latestSeq = versions.length ? Math.max(...versions.map((v) => v.seq)) : 0;

  const send = async () => {
    if (!input.trim() || busy) return;
    setErr("");
    setNote("");
    const attachments = await Promise.all(files.map(fileToDataUri));
    setThread((t) => [...t, { role: "user", text: input, thumbs: attachments }]);
    const instruction = input;
    setInput("");
    setFiles([]);
    setBusy(true);
    try {
      const res = await api<RefineRes>("/api/refine", {
        method: "POST",
        body: JSON.stringify({
          brandId,
          imageUrl: currentUrl,
          instruction,
          attachments,
          contextLabel,
          assetType: asset.type,
          assetId: asset.id,
        }),
      });
      setThread((t) => [...t, { role: "agent", rationale: res.rationale, prompt: res.prompt, url: res.url }]);
      setCurrentUrl(res.url);
      setVersions(res.versions);
      onUpdated?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fork = async () => {
    try {
      await api("/api/assets/fork", {
        method: "POST",
        body: JSON.stringify({ assetType: asset.type, assetId: asset.id, url: currentUrl }),
      });
      setNote("Saved as a new independent asset.");
      onUpdated?.();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const viewingLatest = versions.find((v) => v.url === currentUrl)?.seq === latestSeq || currentUrl === sourceUrl;

  return (
    <div className="grid md:grid-cols-[1fr_360px]" style={{ height: "min(80vh, 780px)" }}>
      {/* Image stage + history */}
      <div className="flex flex-col min-h-0 border-r" style={{ borderColor: "var(--border)" }}>
        <div className="flex-1 min-h-0 flex items-center justify-center p-4" style={{ background: "var(--bg-deep)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt="current" className="max-w-full max-h-full object-contain rounded-2xl" />
        </div>

        {/* Version history strip */}
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="label" style={{ margin: 0 }}>
              Journey · {versions.length} version{versions.length === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <a className="btn-ghost" style={{ padding: "5px 12px", fontSize: 11, textDecoration: "none" }} href={currentUrl} download>
                Download
              </a>
              {allowFork && (
                <button
                  className="btn"
                  style={{ padding: "5px 12px", fontSize: 11 }}
                  onClick={fork}
                  title="Make this exact image its own standalone asset"
                >
                  Make independent
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {versions.map((v) => {
              const active = v.url === currentUrl;
              const isLatest = v.seq === latestSeq;
              return (
                <button
                  key={v.id}
                  onClick={() => setCurrentUrl(v.url)}
                  className="relative shrink-0 rounded-xl overflow-hidden"
                  style={{ border: active ? "2px solid var(--accent)" : "1px solid var(--border)" }}
                  title={v.note || (isLatest ? "current" : `version ${v.seq}`)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.url} alt="" className="w-16 h-20 object-cover" />
                  <span
                    className="absolute bottom-0 inset-x-0 text-center"
                    style={{ fontSize: 9, background: "rgba(0,0,0,0.55)", color: "#fff" }}
                  >
                    {isLatest ? "current" : `v${v.seq}`}
                  </span>
                </button>
              );
            })}
          </div>
          {note && (
            <div className="text-xs mt-2" style={{ color: "var(--accent-strong)" }}>
              {note}
            </div>
          )}
          {!viewingLatest && (
            <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              Viewing an older version — editing from here will branch a new latest. Use “Make independent” to keep it
              as its own asset.
            </div>
          )}
        </div>
      </div>

      {/* Chat pane */}
      <div className="flex flex-col min-h-0">
        <div className="p-3 border-b text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          Tell the agent what to change. It analyzes this image + your samples, then writes the edit. The new result
          replaces the current image; the old one stays in the journey.
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
          {thread.length === 0 && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              e.g. “make the coat charcoal grey”, “warmer golden-hour light”, “use the fabric in this sample”.
            </p>
          )}
          {thread.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="self-end max-w-[90%]">
                <div className="rounded-2xl px-3 py-2 text-sm" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                  {m.text}
                </div>
                {m.thumbs.length > 0 && (
                  <div className="flex gap-1 mt-1 justify-end">
                    {m.thumbs.map((t, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={j} src={t} alt="" className="w-10 h-10 rounded object-cover" />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div key={i} className="self-start max-w-[95%]">
                <div className="card overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />
                  <div className="p-2">
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {m.rationale}
                    </div>
                    <details className="mt-1">
                      <summary className="text-xs cursor-pointer" style={{ color: "var(--muted)" }}>
                        agent prompt
                      </summary>
                      <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "var(--muted)" }}>
                        {m.prompt}
                      </p>
                    </details>
                  </div>
                </div>
              </div>
            )
          )}
          {busy && (
            <div className="self-start flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
              <Spinner /> Agent is analyzing &amp; re-rendering…
            </div>
          )}
        </div>

        {err && (
          <div className="px-3 py-2 text-sm" style={{ color: "var(--danger)" }}>
            {err}
          </div>
        )}

        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          {files.length > 0 && (
            <div className="flex gap-1 mb-2 flex-wrap">
              {files.map((f, i) => (
                <span key={i} className="tag">
                  {f.name.slice(0, 18)}
                  <button
                    onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                    style={{ background: "transparent", border: "none", color: "var(--muted)", marginLeft: 6 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button className="btn-ghost" style={{ padding: "10px 12px" }} onClick={() => fileRef.current?.click()} title="Attach reference samples">
              📎
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => setFiles((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 2))}
            />
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Describe the change…"
              style={{ resize: "none" }}
            />
            <button className="btn" onClick={send} disabled={busy || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
