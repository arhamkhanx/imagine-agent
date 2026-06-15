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
  const { brands, current, setCurrentId, createBrand } = useBrand();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="label">Brand</div>
      {creating ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await createBrand(name.trim());
            setName("");
            setCreating(false);
          }}
          className="flex gap-2"
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" />
          <button className="btn" type="submit">
            Add
          </button>
        </form>
      ) : (
        <div className="flex gap-2">
          <select value={current?.id ?? ""} onChange={(e) => setCurrentId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button className="btn-ghost" style={{ borderRadius: 10, padding: "0 14px" }} onClick={() => setCreating(true)}>
            +
          </button>
        </div>
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
        style={{ background: "var(--panel)", borderRight: "1px solid var(--border)" }}
      >
        <div className="px-5 pt-6 pb-4">
          <div className="text-2xl font-bold tracking-tight">kive</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            AI fashion content studio
          </div>
        </div>
        <BrandSwitcher />
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className="px-3 py-2.5 rounded-xl transition-colors"
                style={{
                  background: active ? "var(--panel-2)" : "transparent",
                  border: active ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                <div className="font-medium text-sm">{n.label}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {n.desc}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 text-xs" style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
          Powered by Grok Imagine + grok-4.3
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
