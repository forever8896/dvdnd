"use client";

// Compliance as a demo of the asset's own rule: tokens leave the issuer and pass a gate that only
// lets verified wallets hold them. Two pass (506(c), Reg S); the unverified one bounces off.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";

const WALLETS = [
  { k: "US accredited", rule: "Reg D 506(c)", ok: true, y: 20 },
  { k: "Non-US resident", rule: "Reg S", ok: true, y: 50 },
  { k: "Unverified wallet", rule: "Refused", ok: false, y: 80 },
];

const OPEN = ["Open-source contracts", "No withdraw button", "Automatic refunds", "Zero-knowledge credentials"];

const ease = [0.22, 1, 0.36, 1] as const;
const BEAT = 1.9;

export function ComplianceGate() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const once = useInView(ref, { amount: 0.35, once: true });
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => setTick((t) => t + 1), BEAT * 1000);
    return () => clearInterval(id);
  }, [inView, reduced]);

  const w = tick % WALLETS.length;
  const target = WALLETS[w];

  return (
    <section ref={ref} className="gate" aria-labelledby="compliance-title">
      <div className="flow-inner gate-grid">
        <div className="gate-copy">
          <div className="flow-eyebrow">Compliance</div>
          <h2 id="compliance-title" className="gate-title">
            Only verified wallets can hold it.
          </h2>
          <p className="gate-line">
            Reg D 506(c) for accredited US investors. Reg S for everyone else. Enforced by Stellar itself, on every
            venue.
          </p>
          <Link href="/docs/legal" className="gate-link">
            How the design stays compliant →
          </Link>
        </div>

        <div className="gate-stage" aria-hidden="true">
          <div className="gate-src">
            <span className="flow-dot flow-dot-token gate-src-token" />
            <span>Issuer</span>
          </div>
          <motion.div
            key={`g${tick}`}
            className="gate-bar"
            initial={false}
            animate={
              reduced
                ? {}
                : {
                    backgroundColor: ["rgba(243,242,242,0.25)", target.ok ? "oklch(0.72 0.14 160)" : "#ff6a52", "rgba(243,242,242,0.25)"],
                    boxShadow: ["0 0 0 rgba(0,0,0,0)", target.ok ? "0 0 28px oklch(0.72 0.14 160 / .7)" : "0 0 28px rgba(255,106,82,.7)", "0 0 0 rgba(0,0,0,0)"],
                  }
            }
            transition={{ duration: 0.9, delay: 0.45, times: [0, 0.3, 1] }}
          >
            <span className="gate-bar-k">Auth required</span>
          </motion.div>

          {WALLETS.map((wl, i) => (
            <motion.div
              key={wl.k + (i === w ? tick : "")}
              className={`gate-wallet${wl.ok ? "" : " is-bad"}`}
              style={{ top: `${wl.y}%` }}
              initial={false}
              animate={
                i === w && !reduced
                  ? { scale: [1, 1, wl.ok ? 1.05 : 0.97, 1], x: wl.ok ? 0 : [0, 0, -6, 5, -3, 0] }
                  : { scale: 1, x: 0 }
              }
              transition={{ duration: 0.6, delay: wl.ok ? 1.0 : 0.45 }}
            >
              <span className={`gate-mark${wl.ok ? "" : " is-bad"}`}>{wl.ok ? "✓" : "✕"}</span>
              <span className="gate-wallet-k">{wl.k}</span>
              <span className="gate-wallet-rule num">{wl.rule}</span>
            </motion.div>
          ))}

          <AnimatePresence>
            {!reduced && inView && (
              <motion.span
                key={tick}
                className="flow-dot flow-dot-token gate-token"
                initial={{ left: "9%", top: "50%", opacity: 0 }}
                animate={
                  target.ok
                    ? { left: ["9%", "47%", "66%"], top: ["50%", `${50 + (target.y - 50) * 0.45}%`, `${target.y}%`], opacity: [0, 1, 0] }
                    : { left: ["9%", "45.5%", "36%"], top: ["50%", `${50 + (target.y - 50) * 0.45}%`, `${50 + (target.y - 50) * 0.7}%`], opacity: [0, 1, 0] }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: target.ok ? 1.2 : 1.1, ease: [0.65, 0, 0.35, 1], times: [0, 0.45, 1] }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flow-inner">
        <ul className="gate-open">
          {OPEN.map((o, i) => (
            <motion.li
              key={o}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={once ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5, ease }}
            >
              <motion.span
                className="gate-open-rule"
                initial={reduced ? false : { scaleX: 0 }}
                animate={once ? { scaleX: 1 } : undefined}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.7, ease }}
              />
              {o}
            </motion.li>
          ))}
        </ul>
        <p className="gate-fine">
          Nothing on this site is an offer to sell, or a solicitation of an offer to buy, any security. Offerings are made
          only to eligible investors through each issuer&apos;s own offering documents.
        </p>
      </div>
    </section>
  );
}
