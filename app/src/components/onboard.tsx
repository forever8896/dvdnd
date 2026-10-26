"use client";

// Shared pieces of the onboarding flows (company and investor): a progress
// rail, an animated stage for each step, and a large heading.

import { motion, useReducedMotion } from "framer-motion";

export const ease = [0.22, 1, 0.36, 1] as const;

export function Rail({ labels, step }: { labels: string[]; step: number }) {
  return (
    <ol className="onb-rail" aria-label="Progress">
      {labels.map((label, i) => (
        <li key={label} data-state={i < step ? "done" : i === step ? "current" : "todo"} aria-current={i === step ? "step" : undefined}>
          <span className="onb-rail-bar">
            <motion.span initial={false} animate={{ scaleX: i < step ? 1 : i === step ? 0.35 : 0 }} transition={{ duration: 0.6, ease }} />
          </span>
          <span className="num">{String(i + 1).padStart(2, "0")}</span> {label}
        </li>
      ))}
    </ol>
  );
}

/** One step's content, sliding in as the previous one leaves. Use inside AnimatePresence with a key. */
export function Stage({ children }: { children: React.ReactNode }) {
  const still = useReducedMotion();
  return (
    <motion.div
      className="onb-stage"
      initial={still ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={still ? undefined : { opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease }}
    >
      {children}
    </motion.div>
  );
}

export function Heading({ kicker, title, lede }: { kicker: string; title: string; lede?: React.ReactNode }) {
  return (
    <header className="onb-head">
      <div className="label">{kicker}</div>
      <h1 className="onb-title">{title}</h1>
      {lede && <p className="onb-lede">{lede}</p>}
    </header>
  );
}
