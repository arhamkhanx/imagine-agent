"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useBrand } from "./BrandContext";

const NAV = [
  { href: "/", label: "Studio", desc: "Agentic generation" },
  { href: "/faces", label: "Faces", desc: "Models & identities" },
  { href: "/products", label: "Products", desc: "Garments & items" },
  { href: "/moodboards", label: "Moodboards", desc: "Aesthetic direction" },
];

function BrandSwitcher() {
  const { brands, current, setCurrentId, createBrand, renameBrand, deleteBrand } = useBrand();
  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const startEdit = () => {
    setName(current?.name ?? "");
    setErr("");
    setMode("edit");
  };

  return (
    <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="label">Brand</div>

      {mode === "create" || mode === "edit" ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            try {
              if (mode === "create") await createBrand(name.trim());
              else if (current) await renameBrand(current.id, name.trim());
              setName("");
              setMode("idle");
            } catch (ex) {
              setErr((ex as Error).message);
            }
          }}
          className="grid gap-2"
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" />
          <div className="flex gap-2">
            <button className="btn" type="submit" style={{ padding: "8px 14px", flex: 1 }}>
              {mode === "create" ? "Add" : "Save"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: "8px 14px" }}
              onClick={() => {
                setMode("idle");
                setErr("");
              }}
            >
              Cancel
            </button>
          </div>
          {err && <div className="text-xs" style={{ color: "var(--danger)" }}>{err}</div>}
        </form>
      ) : (
        <>
          <select value={current?.id ?? ""} onChange={(e) => setCurrentId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-2">
            <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }} onClick={() => { setName(""); setErr(""); setMode("create"); }}>
              + New
            </button>
            <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }} onClick={startEdit}>
              Rename
            </button>
            <button
              className="btn-danger"
              style={{ padding: "6px 12px", fontSize: 11 }}
              onClick={async () => {
                if (!current) return;
                if (!confirm(`Delete brand "${current.name}" and all its content?`)) return;
                try {
                  await deleteBrand(current.id);
                } catch (ex) {
                  alert((ex as Error).message);
                }
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside
        className="w-64 shrink-0 flex flex-col"
        style={{ background: "var(--bg-deep)", borderRight: "1px solid var(--border)" }}
      >
        <div className="px-5 pt-7 pb-5">
          <div className="flex items-center gap-2.5">
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "var(--accent)",
                color: "var(--on-accent)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              i
            </span>
            <div className="text-xl font-bold tracking-tight">imagine-agent</div>
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            AI fashion content studio
          </div>
        </div>
        <BrandSwitcher />
        <nav className="flex-1 p-3 flex flex-col gap-1.5">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className="px-3.5 py-3 rounded-2xl transition-colors"
                style={{
                  background: active ? "rgba(168,213,208,0.12)" : "transparent",
                  border: active ? "1px solid rgba(168,213,208,0.28)" : "1px solid transparent",
                }}
              >
                <div className="font-medium text-sm" style={{ color: active ? "var(--accent-strong)" : "var(--text)" }}>
                  {n.label}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {n.desc}
                </div>
              </Link>
            );
          })}
        </nav>
        <div
          className="p-4 text-xs"
          style={{ color: "var(--muted)", borderTop: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}
        >
          Grok Imagine + grok-4.3
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
