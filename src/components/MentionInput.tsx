"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export type Mention = { handle: string; type: "face" | "product" | "moodboard"; thumb?: string };
export type MentionInputHandle = { insert: (handle: string) => void; clear: () => void; focus: () => void };

const MentionInput = forwardRef<
  MentionInputHandle,
  {
    value: string;
    onChange: (v: string) => void;
    mentions: Mention[];
    placeholder?: string;
    onSubmit?: () => void;
  }
>(function MentionInput({ onChange, mentions, placeholder, onSubmit }, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [suggest, setSuggest] = useState<Mention[]>([]);

  const byHandle = (h: string) => mentions.find((m) => m.handle === h);

  // ---- serialize DOM -> plain text with @handles ----
  const serialize = () => {
    const el = editorRef.current;
    if (!el) return "";
    const walk = (node: ChildNode): string => {
      if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\u00A0/g, " ");
      if (node.nodeType === Node.ELEMENT_NODE) {
        const e = node as HTMLElement;
        if (e.classList.contains("mention-chip")) return `@${e.dataset.handle ?? ""}`;
        if (e.tagName === "BR") return "\n";
        return Array.from(e.childNodes).map(walk).join("");
      }
      return "";
    };
    return Array.from(el.childNodes).map(walk).join("");
  };

  const emit = () => onChange(serialize());

  // ---- build a chip DOM node ----
  const makeChip = (handle: string): HTMLElement => {
    const m = byHandle(handle);
    const span = document.createElement("span");
    span.className = "mention-chip";
    span.contentEditable = "false";
    span.dataset.handle = handle;
    if (m?.thumb) {
      const img = document.createElement("img");
      img.src = m.thumb;
      img.alt = "";
      span.appendChild(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "mb";
      ph.textContent = "MB";
      span.appendChild(ph);
    }
    const t = document.createElement("span");
    t.textContent = `@${handle}`;
    span.appendChild(t);
    return span;
  };

  // ---- caret helpers ----
  const textBeforeCaret = (): string | null => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString();
  };

  const updateSuggest = () => {
    const before = textBeforeCaret();
    if (before == null) return setSuggest([]);
    const m = /@([a-z0-9_]*)$/.exec(before);
    if (!m) return setSuggest([]);
    const q = m[1].toLowerCase();
    setSuggest(mentions.filter((x) => x.handle.includes(q)).slice(0, 6));
  };

  const placeCaretAfter = (node: Node) => {
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  };

  // ---- insert a mention chip at caret (replacing any @query) ----
  const insertMention = (handle: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    const chip = makeChip(handle);
    const space = document.createTextNode("\u00A0");

    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
        const offset = range.startOffset;
        const before = (textNode.textContent ?? "").slice(0, offset);
        const mm = /@([a-z0-9_]*)$/.exec(before);
        const del = document.createRange();
        if (mm) {
          del.setStart(textNode, offset - mm[0].length);
          del.setEnd(textNode, offset);
        } else {
          del.setStart(textNode, offset);
          del.setEnd(textNode, offset);
        }
        del.deleteContents();
        del.insertNode(space);
        del.insertNode(chip);
        placeCaretAfter(space);
        setSuggest([]);
        emit();
        return;
      }
    }
    // Fallback: append at the end with a leading space if needed.
    const last = el.lastChild;
    if (last && !(last.nodeType === Node.TEXT_NODE && /\s$/.test(last.textContent ?? ""))) {
      el.appendChild(document.createTextNode(" "));
    }
    el.appendChild(chip);
    el.appendChild(space);
    placeCaretAfter(space);
    setSuggest([]);
    emit();
  };

  useImperativeHandle(ref, () => ({
    insert: insertMention,
    clear: () => {
      if (editorRef.current) editorRef.current.innerHTML = "";
      setSuggest([]);
      onChange("");
    },
    focus: () => editorRef.current?.focus(),
  }));

  return (
    <div className="relative">
      <div
        ref={editorRef}
        className="mention-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => {
          emit();
          updateSuggest();
        }}
        onKeyUp={updateSuggest}
        onMouseUp={updateSuggest}
        onKeyDown={(e) => {
          if (suggest.length > 0 && e.key === "Enter") {
            e.preventDefault();
            insertMention(suggest[0].handle);
            return;
          }
          if (e.key === "Escape") setSuggest([]);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
      />
      {suggest.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 card p-1 z-20" style={{ background: "var(--panel-2)" }}>
          {suggest.map((s) => (
            <button
              key={`${s.type}_${s.handle}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertMention(s.handle)}
              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-black/30"
              style={{ background: "transparent", border: "none", color: "var(--text)" }}
            >
              {s.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.thumb} alt="" className="w-7 h-7 rounded object-cover" />
              ) : (
                <span className="w-7 h-7 rounded flex items-center justify-center text-xs" style={{ background: "var(--panel)" }}>
                  MB
                </span>
              )}
              <span className="font-mono text-sm">@{s.handle}</span>
              <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>
                {s.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default MentionInput;
