"use client";

import { useRef, useState } from "react";
import { api, fileToDataUri } from "@/lib/client";
import { Spinner } from "./Modal";
import { MAX_SUBJECT_IMAGES } from "@/lib/limits";

type Gen = { id: string; url: string; final_prompt: string; agent_notes: string };

type Msg =
  | { role: "user"; text: string; thumbs: string[] }
  | { role: "agent"; rationale: string; prompt: string; url: string };

export default function RefinePanel({
  brandId,
  sourceUrl,
  contextLabel,
  subject,
  onCreatedGeneration,
  onSavedToSubject,
}: {
  brandId: string;
  sourceUrl: string;
  contextLabel: string;
  subject?: { kind: "face" | "product"; id: string; endpoint: string; count: number };
  onCreatedGeneration?: () => void;
  onSavedToSubject?: () => void;
}) {
  const [thread, setThread] = useState<Msg[]>([]);
  const [currentUrl, setCurrentUrl] = useState(sourceUrl);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [savedUrls, setSavedUrls] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const subjectFull = subject ? subject.count + savedCount >= MAX_SUBJECT_IMAGES : false;

  const send = async () => {
    if (!input.trim() || busy) return;
    setErr("");
    const attachments = await Promise.all(files.map(fileToDataUri));
    setThread((t) => [...t, { role: "user", text: input, thumbs: attachments }]);
    const instruction = input;
    setInput("");
    setFiles([]);
    setBusy(true);
    try {
      const gen = await api<Gen>("/api/refine", {
        method: "POST",
        body: JSON.stringify({
          brandId,
          imageUrl: currentUrl,
          instruction,
          attachments,
          contextLabel,
        }),
      });
      setThread((t) => [
        ...t,
        { role: "agent", rationale: gen.agent_notes, prompt: gen.final_prompt, url: gen.url },
      ]);
      setCurrentUrl(gen.url);
      onCreatedGeneration?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveToSubject = async () => {
    if (!subject) return;
    try {
      await api(`${subject.endpoint}/${subject.id}/images`, {
        method: "POST",
        body: JSON.stringify({ url: currentUrl, label: "refined" }),
      });
      setSavedCount((c) => c + 1);
      setSavedUrls((u) => [...u, currentUrl]);
      onSavedToSubject?.();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const changed = currentUrl !== sourceUrl;
  const alreadySaved = savedUrls.includes(currentUrl);

  return (
    <div className="grid md:grid-cols-[1fr_360px] gap-0" style={{ height: "min(78vh, 760px)" }}>
      {/* Image stage */}
      <div className="flex flex-col min-h-0 border-r" style={{ borderColor: "var(--border)" }}>
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt="current" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
        <div className="p-3 flex items-center gap-2 border-t" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {changed ? "Latest refinement" : "Original"}
          </span>
          <div className="ml-auto flex gap-2">
            <a className="btn-ghost" style={{ borderRadius: 10, padding: "6px 12px", fontSize: 13, textDecoration: "none" }} href={currentUrl} download>
              Download
            </a>
            {subject && changed && (
              <button
                className="btn"
                style={{ padding: "6px 12px", fontSize: 13 }}
                onClick={saveToSubject}
                disabled={subjectFull || alreadySaved}
                title={subjectFull ? `Limit ${MAX_SUBJECT_IMAGES} reached` : ""}
              >
                {alreadySaved ? "Saved ✓" : subjectFull ? "Limit reached" : `Save to @ (${subject.count + savedCount}/${MAX_SUBJECT_IMAGES})`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat pane */}
      <div className="flex flex-col min-h-0">
        <div className="p-3 border-b text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          Tell the agent what to change. It analyzes this image + your samples, then writes the edit.
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
                <div className="rounded-2xl px-3 py-2 text-sm" style={{ background: "var(--accent)", color: "#0a0a0b" }}>
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
              <Spinner /> Agent is analyzing & re-rendering…
            </div>
          )}
        </div>

        {err && (
          <div className="px-3 py-2 text-sm" style={{ color: "#ff8a9b" }}>
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
            <button
              className="btn-ghost"
              style={{ borderRadius: 10, padding: "10px 12px" }}
              onClick={() => fileRef.current?.click()}
              title="Attach reference samples"
            >
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
