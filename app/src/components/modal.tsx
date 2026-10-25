"use client";

import { useEffect } from "react";

/** Modal on desktop, bottom sheet on phones. */
export function Modal({
  title,
  step,
  onClose,
  children,
}: {
  title: React.ReactNode;
  step?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--hair)" }}>
          <div style={{ font: "800 18px var(--font-sans)", flex: 1, display: "flex", gap: 8, alignItems: "center" }}>{title}</div>
          {step && <span className="label">{step}</span>}
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
      </div>
    </div>
  );
}

export function ReceiptRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hair)", fontSize: 13 }}>
      <span className="muted">{label}</span>
      <span className="num" style={{ textAlign: "right" }}>
        {children}
      </span>
    </div>
  );
}
