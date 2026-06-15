"use client";

import { useEffect } from "react";

export default function Modal({
  open,
  onClose,
  children,
  width = 720,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onMouseDown={onClose}
    >
      <div
        className="card w-full my-auto"
        style={{ maxWidth: width, background: "var(--panel)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose }: { title: React.ReactNode; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="min-w-0">
        <div className="text-lg font-semibold truncate">{title}</div>
        {subtitle && (
          <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {subtitle}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{ background: "var(--panel-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 10, width: 34, height: 34 }}
      >
        ✕
      </button>
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid rgba(255,255,255,0.25)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "imagine-agent-spin 0.7s linear infinite",
      }}
    />
  );
}
