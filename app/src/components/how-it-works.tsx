"use client";

// "How it works" as a pinned, scroll-driven diagram. Each scroll step plays one stage of a raise
// (business → escrow → investors and back) beside one big word and one line. Money moves as dots:
// round ones are USDC, square ones are the business's tokens. Reduced motion gets a plain list.

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";

const STEPS = [
  { k: "Verify", line: "The business proves it's real. Its agreement is fingerprinted on-chain." },
  { k: "Raise", line: "It sets a price, a target and a deadline." },
  { k: "Invest", line: "Verified investors fund an on-chain escrow." },
  { k: "Close", line: "Target hit: the business is paid. Missed: everyone is refunded." },
  { k: "Lock", line: "Investors lock their tokens for the term." },
  { k: "Earn", line: "Profit flows back in USDC, split pro-rata." },
];

type P = { x: number; y: number };
const BIZ: P = { x: 13, y: 44 };
const ESC: P = { x: 50, y: 44 };
const INV: P[] = [
  { x: 87, y: 14 },
  { x: 87, y: 34 },
  { x: 87, y: 54 },
  { x: 87, y: 74 },
];
const CHAIN: P = { x: 13, y: 93 };
const INV_TAGS = ["US · 506(c)", "Non-US · Reg S", "US · 506(c)", "Non-US · Reg S"];
const ESC_FILL = [0, 0, 0.82, 0, 0, 0];
// Which connections carry something at each step.
const LIVE: string[][] = [["chain"], [], ["i0", "i1", "i2", "i3"], ["biz", "i0", "i1", "i2", "i3"], ["i0", "i1", "i2", "i3"], ["biz", "i0", "i1", "i2", "i3"]];

const ease = [0.22, 1, 0.36, 1] as const;

export function HowItWorks() {
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => setStep(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))));

  if (reduced) {
    return (
      <section id="how-it-works" className="hiw flow-static" aria-labelledby="hiw-title">
        <div className="flow-inner">
          <div className="flow-eyebrow">How it works</div>
          <h2 id="hiw-title" className="flow-title">From raise to dividend, on-chain.</h2>
          <ol className="flow-list">
            {STEPS.map((s, i) => (
              <li key={s.k}>
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <strong>{s.k}</strong>
                <span>{s.line}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  const s = STEPS[step];
  return (
    <section ref={trackRef} id="how-it-works" className="hiw" aria-labelledby="hiw-title">
      <div className="flow-stage">
        <div className="flow-inner flow-grid">
          <div className="flow-copy">
            <div className="flow-eyebrow">How it works</div>
            <h2 id="hiw-title" className="sr-only">From raise to dividend, on-chain.</h2>
            <div className="flow-ticks" aria-hidden="true">
              {STEPS.map((t, i) => (
                <span key={t.k} className={i <= step ? "is-on" : undefined} />
              ))}
            </div>
            <div className="flow-count num" aria-hidden="true">
              {String(step + 1).padStart(2, "0")} <span>/ {String(STEPS.length).padStart(2, "0")}</span>
            </div>
            <div className="flow-word-mask">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={s.k}
                  className="flow-word"
                  initial={{ y: "105%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-105%" }}
                  transition={{ duration: 0.45, ease }}
                >
                  {s.k}.
                </motion.div>
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={s.k}
                className="flow-line"
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                transition={{ duration: 0.4, ease, delay: 0.08 }}
              >
                {s.line}
              </motion.p>
            </AnimatePresence>
            <ol className="sr-only">
              {STEPS.map((t) => (
                <li key={t.k}>
                  {t.k}: {t.line}
                </li>
              ))}
            </ol>
          </div>

          <Diagram step={step} />
        </div>
      </div>
    </section>
  );
}

function Diagram({ step }: { step: number }) {
  const live = LIVE[step];
  const fill = ESC_FILL[step];
  const vault = step >= 4;
  return (
    <div className="flow-diagram" aria-hidden="true">
      <svg className="flow-wires" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Wire a={BIZ} b={CHAIN} on={live.includes("chain")} />
        <Wire a={BIZ} b={ESC} on={live.includes("biz")} shown={step >= 1} />
        {INV.map((p, i) => (
          <Wire key={i} a={ESC} b={p} on={live.includes(`i${i}`)} shown={step >= 2} />
        ))}
      </svg>

      {/* Business */}
      <Node at={BIZ} className="flow-node flow-biz">
        <span className="flow-node-k">Business</span>
        <motion.span
          className="flow-check"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.3 }}
        >
          ✓
        </motion.span>
      </Node>

      {/* Escrow, which becomes the vault */}
      <motion.div
        className="flow-node flow-esc"
        style={{ left: `${ESC.x}%`, top: `${ESC.y}%` }}
        initial={false}
        animate={{ opacity: step >= 1 ? 1 : 0, scale: step >= 1 ? 1 : 0.85 }}
        transition={{ duration: 0.5, ease }}
      >
        <motion.span className="flow-esc-fill" initial={false} animate={{ scaleY: fill }} transition={{ duration: 1.6, ease }} />
        <span className={`flow-esc-min${fill >= 0.6 ? " is-met" : ""}`} style={{ opacity: step >= 1 && step <= 3 ? 1 : 0 }} />
        <span className="flow-node-k">{vault ? "Vault" : "Escrow"}</span>
        <motion.span className="flow-lock" initial={false} animate={{ opacity: vault ? 1 : 0, y: vault ? 0 : -8 }} transition={{ duration: 0.4, ease }}>
          <svg viewBox="0 0 16 16" width="16" height="16">
            <motion.path
              d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              initial={false}
              animate={{ y: vault ? 0 : -2.5 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 500, damping: 20 }}
            />
            <rect x="3" y="7" width="10" height="7.5" fill="currentColor" />
          </svg>
        </motion.span>
      </motion.div>

      <AnimatePresence>
        {step === 1 && (
          <motion.div className="flow-terms" style={{ left: `${ESC.x}%`, top: `${ESC.y - 21}%` }} exit={{ opacity: 0 }}>
            {["$10 / token", "Target $300k", "30 days"].map((t, i) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.4, ease }}
              >
                {t}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Investors */}
      {INV.map((p, i) => (
        <motion.div
          key={i}
          className="flow-node flow-inv"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          initial={false}
          animate={{ opacity: step >= 2 ? 1 : 0.22 }}
          transition={{ duration: 0.4, delay: step >= 2 ? i * 0.07 : 0 }}
        >
          <span className="flow-inv-dot" />
          <span className="flow-inv-tag">{INV_TAGS[i]}</span>
        </motion.div>
      ))}

      {/* The ledger: always moving */}
      <div className="flow-chain" style={{ top: `${CHAIN.y}%` }}>
        <span className="flow-chain-k">Stellar</span>
        <div className="flow-chain-blocks">
          {Array.from({ length: 28 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>

      <Particles key={step} step={step} />
    </div>
  );
}

function Node({ at, className, children }: { at: P; className: string; children: React.ReactNode }) {
  return (
    <div className={className} style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      {children}
    </div>
  );
}

function Wire({ a, b, on, shown = true }: { a: P; b: P; on: boolean; shown?: boolean }) {
  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      className={`flow-wire${on ? " is-on" : ""}`}
      style={{ opacity: shown ? 1 : 0 }}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Particles({ step }: { step: number }) {
  switch (step) {
    case 0:
      return <Dot kind="doc" path={[BIZ, CHAIN]} />;
    case 2:
      return INV.map((p, i) => <Dot key={i} kind="usdc" path={[p, ESC]} delay={i * 0.3} />);
    case 3:
      return (
        <>
          {[0, 1, 2].map((i) => (
            <Dot key={`u${i}`} kind="usdc" path={[ESC, BIZ]} delay={i * 0.35} />
          ))}
          {INV.map((p, i) => (
            <Dot key={`t${i}`} kind="token" path={[ESC, p]} delay={0.5 + i * 0.25} />
          ))}
        </>
      );
    case 4:
      return INV.map((p, i) => <Dot key={i} kind="token" path={[p, ESC]} delay={i * 0.25} once />);
    case 5:
      return INV.map((p, i) => <Dot key={i} kind="usdc" path={[BIZ, ESC, p]} delay={i * 0.3} />);
    default:
      return null;
  }
}

function Dot({ path, kind, delay = 0, once }: { path: P[]; kind: "usdc" | "token" | "doc"; delay?: number; once?: boolean }) {
  const duration = 1.1 + path.length * 0.35;
  const loop = once ? {} : { repeat: Infinity, repeatDelay: 0.5 };
  return (
    <motion.span
      className={`flow-dot flow-dot-${kind}`}
      initial={{ left: `${path[0].x}%`, top: `${path[0].y}%`, opacity: 0 }}
      animate={{ left: path.map((p) => `${p.x}%`), top: path.map((p) => `${p.y}%`), opacity: once ? [0, 1, 1, 0] : [0, 1, 1, 0] }}
      transition={{
        default: { duration, delay, ease: [0.65, 0, 0.35, 1], ...loop },
        opacity: { duration, delay, times: [0, 0.12, 0.88, 1], ...loop },
      }}
    >
      {kind === "usdc" ? "$" : null}
    </motion.span>
  );
}
