"use client";

// Testnet only: one click to become a demo persona (a ready company, or an
// investor who is already eligible), so a live demo needs no sign-in juggling.

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ease } from "./onboard";
import { IS_TESTNET } from "@/lib/config";
import { useWallet, type Role } from "@/lib/wallet";

type Persona = { id: string; role: Role; name: string; blurb: string; publicKey: string };

export function DemoSwitcher() {
  const router = useRouter();
  const { signer, importSecret } = useWallet();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!IS_TESTNET) return;
    fetch("/api/demo")
      .then((r) => r.json() as Promise<Persona[]>)
      .then(setPersonas)
      .catch(() => setPersonas([]));
  }, []);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!IS_TESTNET || !personas.length) return null;

  async function become(p: Persona) {
    setBusy(p.id);
    setError(null);
    try {
      const res = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id }) });
      const body = (await res.json()) as { role?: Role; secret?: string; error?: string };
      if (!body.secret || !body.role) throw new Error(body.error ?? "Couldn't load the persona.");
      await importSecret(body.role, body.secret);
      setOpen(false);
      router.push(body.role === "company" ? "/company" : "/discover");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const current = (p: Persona) => signer[p.role]?.publicKey === p.publicKey;
  const active = personas.filter(current);

  return (
    <div className="demo" ref={box}>
      <button type="button" className="demo-trigger" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="demo-dot" />
        {active.length ? active.map((p) => p.name.split(" ")[0]).join(" · ") : "Demo"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="demo-panel"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease }}
          >
            <div className="demo-head">
              <span className="label">Testnet demo</span>
              <span className="small">Switch who you are. Company and investor are separate wallets, so you can hold one of each.</span>
            </div>
            {(["company", "investor"] as const).map((role) => (
              <div key={role} className="demo-group">
                <div className="label">{role === "company" ? "Company" : "Investors"}</div>
                {personas
                  .filter((p) => p.role === role)
                  .map((p) => (
                    <button key={p.id} type="button" role="menuitem" className="demo-persona" data-current={current(p)} disabled={busy !== null} onClick={() => become(p)}>
                      <span className="demo-avatar">{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                      <span className="demo-text">
                        <span className="demo-name">{p.name}</span>
                        <span className="small">{busy === p.id ? "Switching…" : p.blurb}</span>
                      </span>
                      {current(p) && <span className="demo-you">You</span>}
                    </button>
                  ))}
              </div>
            ))}
            {error && <div className="small red">{error}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
