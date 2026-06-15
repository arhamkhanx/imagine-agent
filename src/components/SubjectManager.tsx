"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrand } from "./BrandContext";
import { api, fileToDataUri, ASPECT_RATIOS } from "@/lib/client";
import { MAX_SUBJECT_IMAGES, FACE_ANGLES, PRODUCT_ANGLES } from "@/lib/limits";
import Modal, { ModalHeader, Spinner } from "./Modal";
import RefinePanel from "./RefinePanel";

type Img = { id: string; url: string; label: string; is_primary: number };
type Subject = { id: string; name: string; description: string; images: Img[] };

export default function SubjectManager({
  kind,
  endpoint,
}: {
  kind: "face" | "product";
  endpoint: string;
}) {
  const { current } = useBrand();
  const [items, setItems] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Subject | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const list = await api<Subject[]>(`${endpoint}?brand=${current.id}`);
      setItems(list);
      // Keep the open detail modal in sync after edits.
      setDetail((d) => (d ? list.find((x) => x.id === d.id) ?? null : null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [current, endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  const noun = kind === "face" ? "face" : "product";

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight capitalize">{noun}s</h1>
          <p style={{ color: "var(--muted)" }} className="text-sm mt-1">
            {kind === "face"
              ? "Upload real model photos or generate new AI models. Add angles, then reference them with @handle."
              : "Upload product shots or generate new ones. Add angles, then reference them with @handle."}
          </p>
        </div>
        <button className="btn" onClick={() => setCreateOpen(true)} disabled={!current}>
          New {noun}
        </button>
      </div>

      {error && (
        <div className="card p-3 mb-4 text-sm" style={{ color: "#ff8a9b", borderColor: "#5a2a32" }}>
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="aspect-[3/4] skeleton" />
              <div className="p-4">
                <div className="h-4 w-24 skeleton rounded mb-2" />
                <div className="h-3 w-full skeleton rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: "var(--muted)" }}>
          No {noun}s yet. Click “New {noun}” to add your first.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {items.map((it) => {
            const primary = it.images.find((i) => i.is_primary) ?? it.images[0];
            return (
              <button
                key={it.id}
                onClick={() => setDetail(it)}
                className="card overflow-hidden text-left group"
                style={{ background: "var(--panel)" }}
              >
                <div className="aspect-[3/4] bg-black/40 overflow-hidden relative">
                  {primary ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={primary.url}
                      alt={it.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="flex items-center justify-center h-full" style={{ color: "var(--muted)" }}>
                      no image
                    </span>
                  )}
                  <span
                    className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                  >
                    {it.images.length}/{MAX_SUBJECT_IMAGES}
                  </span>
                </div>
                <div className="p-3">
                  <div className="tag mb-1">@{it.name}</div>
                  <p className="text-xs line-clamp-2" style={{ color: "var(--muted)" }}>
                    {it.description || "No description"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} width={640}>
        {current && (
          <CreateModal
            kind={kind}
            endpoint={endpoint}
            brandId={current.id}
            onClose={() => setCreateOpen(false)}
            onDone={(created) => {
              setCreateOpen(false);
              load().then(() => setDetail(created));
            }}
          />
        )}
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} width={860}>
        {detail && current && (
          <DetailModal
            kind={kind}
            endpoint={endpoint}
            brandId={current.id}
            item={detail}
            onClose={() => setDetail(null)}
            onChange={load}
          />
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------- Create modal ------------------------------- */

function CreateModal({
  kind,
  endpoint,
  brandId,
  onClose,
  onDone,
}: {
  kind: "face" | "product";
  endpoint: string;
  brandId: string;
  onClose: () => void;
  onDone: (created: Subject) => void;
}) {
  const [step, setStep] = useState(0); // 0 = source, 1 = details
  const [mode, setMode] = useState<"upload" | "generate" | null>(null);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState(kind === "face" ? "2:3" : "1:1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const noun = kind;
  const anglePresets = kind === "face" ? FACE_ANGLES : PRODUCT_ANGLES;
  const sanitizeLabel = (v: string) =>
    v.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 24);

  const onPickFiles = (picked: File[]) => {
    const next = picked.slice(0, MAX_SUBJECT_IMAGES);
    setFiles(next);
    // Default each label from the preset list by position; first stays "primary".
    setLabels(next.map((_, i) => (i === 0 ? "primary" : anglePresets[i]?.id ?? "")));
  };
  const setLabelAt = (i: number, v: string) =>
    setLabels((prev) => prev.map((x, idx) => (idx === i ? sanitizeLabel(v) : x)));

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      let created: Subject;
      if (mode === "upload") {
        if (!files.length) throw new Error("Select at least one image");
        if (files.length > MAX_SUBJECT_IMAGES) throw new Error(`Max ${MAX_SUBJECT_IMAGES} images`);
        const dataUris = await Promise.all(files.map(fileToDataUri));
        const images = dataUris.map((dataUri, i) => ({ dataUri, label: labels[i] || (i === 0 ? "primary" : "source") }));
        created = await api<Subject>(endpoint, {
          method: "POST",
          body: JSON.stringify({ brandId, name, mode: "upload", images }),
        });
      } else {
        if (!prompt.trim()) throw new Error("Enter a description");
        created = await api<Subject>(endpoint, {
          method: "POST",
          body: JSON.stringify({ brandId, name, mode: "generate", prompt, aspectRatio: aspect }),
        });
      }
      onDone(created);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ModalHeader
        title={`New ${noun}`}
        subtitle={step === 0 ? "Step 1 of 2 · Choose a source" : "Step 2 of 2 · Details"}
        onClose={onClose}
      />
      <div className="p-5">
        <Stepper step={step} labels={["Source", "Details"]} />

        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-4 mt-5">
            <SourceCard
              active={mode === "upload"}
              title="Upload images"
              desc={kind === "face" ? "Use real photos of a model you already have." : "Use real photos of your product."}
              onClick={() => setMode("upload")}
            />
            <SourceCard
              active={mode === "generate"}
              title="Generate with AI"
              desc={kind === "face" ? "Create a brand-new AI model from a description." : "Create a new product shot from a description."}
              onClick={() => setMode("generate")}
            />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 mt-5">
            <div>
              <label className="label">Name (optional — a unique @handle is auto-created)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. ${kind === "face" ? "anna_studio" : "linen_blazer"}`}
              />
            </div>

            {mode === "upload" ? (
              <div>
                <label className="label">Images · first becomes primary · max {MAX_SUBJECT_IMAGES}</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => onPickFiles(Array.from(e.target.files ?? []))}
                />
                {files.length > 0 && (
                  <>
                    <p className="text-xs mt-3 mb-2" style={{ color: "var(--muted)" }}>
                      Label each angle in a single word (no spaces) — pick a suggestion or type your own.
                    </p>
                    <datalist id={`angle-presets-${kind}`}>
                      {anglePresets.map((a) => (
                        <option key={a.id} value={a.id} />
                      ))}
                    </datalist>
                    <div className="grid gap-2">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={URL.createObjectURL(f)}
                            alt={f.name}
                            className="w-12 h-16 object-cover rounded-lg border shrink-0"
                            style={{ borderColor: i === 0 ? "var(--accent)" : "var(--border)" }}
                          />
                          <div className="flex-1 min-w-0">
                            <input
                              list={`angle-presets-${kind}`}
                              value={labels[i] ?? ""}
                              onChange={(e) => setLabelAt(i, e.target.value)}
                              placeholder={i === 0 ? "primary" : "e.g. front"}
                              style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
                            />
                          </div>
                          {i === 0 && <span className="tag shrink-0">primary</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label className="label">{kind === "face" ? "Describe the model" : "Describe the product"}</label>
                  <textarea
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      kind === "face"
                        ? "early-20s woman, warm olive skin, dark wavy shoulder-length hair, freckles, soft features"
                        : "oversized double-breasted linen blazer in sand beige with horn buttons"
                    }
                  />
                </div>
                <div className="max-w-[200px]">
                  <label className="label">Aspect ratio</label>
                  <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                    {ASPECT_RATIOS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {err && <div style={{ color: "#ff8a9b" }} className="text-sm">{err}</div>}

            {busy && (
              <div className="card p-4 flex items-center gap-3" style={{ background: "var(--panel-2)" }}>
                <Spinner />
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  {mode === "generate"
                    ? `Generating your ${noun} at maximum quality — this can take a moment…`
                    : "Saving & analyzing your images…"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-5 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          className="btn-ghost"
          style={{ borderRadius: 10, padding: "10px 16px", opacity: step === 0 ? 0.4 : 1 }}
          disabled={step === 0 || busy}
          onClick={() => setStep(0)}
        >
          ← Back
        </button>
        {step === 0 ? (
          <button className="btn" disabled={!mode} onClick={() => setStep(1)}>
            Continue
          </button>
        ) : (
          <button className="btn" disabled={busy} onClick={submit}>
            {busy ? "Working…" : mode === "generate" ? `Generate ${noun}` : `Create ${noun}`}
          </button>
        )}
      </div>
    </>
  );
}

function SourceCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card p-5 text-left transition-colors"
      style={{
        background: active ? "var(--panel-2)" : "var(--panel)",
        borderColor: active ? "var(--accent)" : "var(--border)",
      }}
    >
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {desc}
      </div>
    </button>
  );
}

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className="flex items-center justify-center text-xs font-semibold rounded-full"
              style={{
                width: 22,
                height: 22,
                background: i <= step ? "var(--accent)" : "var(--panel-2)",
                color: i <= step ? "#042624" : "var(--muted)",
              }}
            >
              {i + 1}
            </span>
            <span className="text-sm" style={{ color: i <= step ? "var(--text)" : "var(--muted)" }}>
              {l}
            </span>
          </div>
          {i < labels.length - 1 && <div style={{ width: 28, height: 1, background: "var(--border)" }} />}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Detail modal ------------------------------- */

function DetailModal({
  kind,
  endpoint,
  brandId,
  item,
  onClose,
  onChange,
}: {
  kind: "face" | "product";
  endpoint: string;
  brandId: string;
  item: Subject;
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [desc, setDesc] = useState(item.description);
  const [editing, setEditing] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [err, setErr] = useState("");

  const [sel, setSel] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]); // angle ids being generated
  const [active, setActive] = useState<string | null>(null); // currently zoomed image url
  const [refineImg, setRefineImg] = useState<Img | null>(null);

  const angles = kind === "face" ? FACE_ANGLES : PRODUCT_ANGLES;
  const remaining = MAX_SUBJECT_IMAGES - item.images.length;
  const atLimit = remaining <= 0;
  const primary = item.images.find((i) => i.is_primary) ?? item.images[0];

  useEffect(() => {
    setName(item.name);
    setDesc(item.description);
  }, [item]);

  const saveMeta = async () => {
    setSavingMeta(true);
    setErr("");
    try {
      await api(`${endpoint}/${item.id}`, { method: "PATCH", body: JSON.stringify({ name, description: desc }) });
      await onChange();
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSavingMeta(false);
    }
  };

  const removeSubject = async () => {
    if (!confirm(`Delete @${item.name}? This cannot be undone.`)) return;
    await api(`${endpoint}/${item.id}`, { method: "DELETE" });
    await onChange();
    onClose();
  };

  const genAngles = async () => {
    const toGen = sel.slice(0, remaining);
    if (!toGen.length) return;
    setPending(toGen);
    setSel([]);
    setErr("");
    try {
      const res = await api<{ skipped: number }>(`${endpoint}/${item.id}/angles`, {
        method: "POST",
        body: JSON.stringify({ angles: toGen }),
      });
      if (res.skipped > 0) setErr(`${res.skipped} angle(s) skipped — image limit (${MAX_SUBJECT_IMAGES}) reached.`);
      await onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPending([]);
    }
  };

  const setPrimary = async (imageId: string) => {
    await api(`${endpoint}/${item.id}/images/${imageId}`, { method: "PATCH" });
    await onChange();
  };

  const deleteImage = async (imageId: string) => {
    try {
      await api(`${endpoint}/${item.id}/images/${imageId}`, { method: "DELETE" });
      await onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const labelFor = (id: string) => angles.find((a) => a.id === id)?.label ?? id.replace(/_/g, " ");

  return (
    <>
      <ModalHeader
        title={
          editing ? (
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 280, fontFamily: "var(--font-mono)" }} />
          ) : (
            <span className="tag">@{item.name}</span>
          )
        }
        subtitle={`${item.images.length}/${MAX_SUBJECT_IMAGES} images`}
        onClose={onClose}
      />

      <div className="p-5 grid md:grid-cols-[300px_1fr] gap-6">
        {/* Left: primary preview */}
        <div>
          <div className="card overflow-hidden aspect-[3/4] bg-black/40">
            {primary && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(active ?? primary.url)} alt={item.name} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex gap-2 mt-3">
            {!editing ? (
              <button className="btn-ghost" style={{ borderRadius: 10, padding: "8px 12px", fontSize: 13 }} onClick={() => setEditing(true)}>
                Edit details
              </button>
            ) : (
              <>
                <button className="btn" style={{ padding: "8px 12px", fontSize: 13 }} onClick={saveMeta} disabled={savingMeta}>
                  {savingMeta ? "Saving…" : "Save"}
                </button>
                <button
                  className="btn-ghost"
                  style={{ borderRadius: 10, padding: "8px 12px", fontSize: 13 }}
                  onClick={() => {
                    setEditing(false);
                    setName(item.name);
                    setDesc(item.description);
                  }}
                >
                  Cancel
                </button>
              </>
            )}
            <button className="btn-danger" style={{ borderRadius: 10, padding: "8px 12px", fontSize: 13 }} onClick={removeSubject}>
              Delete
            </button>
          </div>
        </div>

        {/* Right: details + gallery + angles */}
        <div className="min-w-0">
          <div className="label">Description</div>
          {editing ? (
            <textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
          ) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {item.description || "No description"}
            </p>
          )}

          <div className="label mt-5">All images</div>
          <div className="grid grid-cols-4 gap-2">
            {item.images.map((im) => (
              <div
                key={im.id}
                className="relative group rounded-lg overflow-hidden border"
                style={{ borderColor: im.is_primary ? "var(--accent)" : "var(--border)" }}
                onMouseEnter={() => setActive(im.url)}
                onMouseLeave={() => setActive(null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt={im.label} title={im.label} className="w-full aspect-[3/4] object-cover" />
                {im.is_primary === 1 && (
                  <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--accent)", color: "#042624" }}>
                    primary
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-1 flex gap-1 items-center opacity-0 group-hover:opacity-100 transition" style={{ background: "rgba(0,0,0,0.55)" }}>
                  {im.is_primary !== 1 && (
                    <button onClick={() => setPrimary(im.id)} title="Set as primary" style={{ background: "transparent", border: "none", color: "#fff", fontSize: 11 }}>
                      ★
                    </button>
                  )}
                  <button onClick={() => setRefineImg(im)} title="Refine with agent" style={{ background: "transparent", border: "none", color: "#fff", fontSize: 11 }}>
                    ✎
                  </button>
                  {item.images.length > 1 && (
                    <button onClick={() => deleteImage(im.id)} title="Delete image" style={{ background: "transparent", border: "none", color: "#ff8a9b", fontSize: 11, marginLeft: "auto" }}>
                      ✕
                    </button>
                  )}
                </div>
                <span className="absolute top-1 right-1 text-[9px] px-1 rounded" style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}>
                  {labelFor(im.label)}
                </span>
              </div>
            ))}
            {/* Live placeholders while angles generate */}
            {pending.map((a) => (
              <div key={`pending_${a}`} className="relative rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                <div className="w-full aspect-[3/4] skeleton flex items-center justify-center flex-col gap-2">
                  <Spinner />
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                    {labelFor(a)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Angle generation */}
          <div className="label mt-5">
            Generate angles {atLimit && <span style={{ color: "#ff8a9b" }}>· limit reached</span>}
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
            {atLimit
              ? `You have ${MAX_SUBJECT_IMAGES} images. Delete one to add more.`
              : `Pick angles to create from the primary image. ${remaining} slot(s) left.`}
          </p>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {angles.map((a) => {
              const on = sel.includes(a.id);
              const disabled = atLimit || pending.length > 0 || (!on && sel.length >= remaining);
              return (
                <button
                  key={a.id}
                  disabled={disabled}
                  onClick={() => setSel((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                  className="tag"
                  style={{
                    background: on ? "var(--accent)" : "var(--panel-2)",
                    color: on ? "#042624" : "var(--accent)",
                    opacity: disabled ? 0.4 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
          <button
            className="btn"
            style={{ padding: "8px 14px" }}
            disabled={!sel.length || pending.length > 0 || atLimit}
            onClick={genAngles}
          >
            {pending.length > 0 ? (
              <>
                <Spinner /> Generating {pending.length} angle(s)…
              </>
            ) : (
              `Generate ${sel.length || ""} angle(s)`
            )}
          </button>

          {err && (
            <div className="mt-3 text-sm" style={{ color: "#ff8a9b" }}>
              {err}
            </div>
          )}
        </div>
      </div>

      <Modal open={!!refineImg} onClose={() => setRefineImg(null)} width={1000}>
        {refineImg && (
          <>
            <ModalHeader
              title={`Refine @${item.name}`}
              subtitle={`${labelFor(refineImg.label)} · agent edits with your comments & samples`}
              onClose={() => setRefineImg(null)}
            />
            <RefinePanel
              brandId={brandId}
              sourceUrl={refineImg.url}
              contextLabel={`a ${kind} image of @${item.name} (${labelFor(refineImg.label)})`}
              asset={{ type: kind === "face" ? "face_image" : "product_image", id: refineImg.id }}
              onUpdated={onChange}
            />
          </>
        )}
      </Modal>
    </>
  );
}
