"use client";

// "How it works" as an animated diagram: the six steps light up in order and a
// USDC marker travels along the rail, once, when the section scrolls into view.
// With reduced motion everything is shown lit and still.

import { useEffect, useRef, useState } from "react";

const STEPS = [
  { k: "Verify", body: "The company proves it owns the business and signs a profit-share agreement. Its hash is recorded on-chain." },
  { k: "Raise", body: "It opens a fixed-price raise with a minimum, a maximum and a deadline." },
  { k: "Invest", body: "Verified investors fund an on-chain escrow: accredited US investors under Reg D 506(c), non-US investors under Reg S." },
  { k: "Close", body: "Minimum reached: the company is paid. Missed: every investor is refunded automatically." },
  { k: "Lock", body: "Holders lock their tokens in the vault for the period." },
  { k: "Earn", body: "The company pays its profit share in USDC, split pro-rata among everyone who stayed locked." },
];

const OPEN = [
  { k: "Open-source contracts", body: "Each company deploys its own raise. The code is public." },
  { k: "No one holds the money", body: "Escrowed USDC can only go to the company or back to investors. There's no withdraw button." },
  { k: "Rules in the protocol", body: "Stellar refuses transfers to unverified wallets on every venue, so holding rules can't be bypassed." },
  { k: "Credentials, not files", body: "Investors prove eligibility with a zero-knowledge proof. The chain checks it without learning who they are." },
];

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setPlaying(true);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setPlaying(true);
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id="how-it-works" className="page hiw" aria-labelledby="hiw-title">
      <div className="hiw-head">
        <div className="label">How it works</div>
        <h2 id="hiw-title" className="h1">From raise to dividend, on-chain.</h2>
      </div>

      <ol className={`hiw-steps${playing ? " is-playing" : ""}`}>
        <div className="hiw-rail" aria-hidden="true">
          <span className="hiw-rail-fill" />
          <span className="hiw-coin">USDC</span>
        </div>
        {STEPS.map((s, i) => (
          <li key={s.k} className="hiw-step" style={{ ["--i" as string]: i }}>
            <span className="hiw-dot" aria-hidden="true" />
            <span className="num hiw-n">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="h3">{s.k}</h3>
            <p className="muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="hiw-open">
        <div className="label">Open by design</div>
        <div className="hiw-open-grid">
          {OPEN.map((o) => (
            <div key={o.k}>
              <h3 className="h3">{o.k}</h3>
              <p className="muted">{o.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
