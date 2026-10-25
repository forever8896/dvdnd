import Link from "next/link";
import { LandingFilm } from "@/components/landing-film";
import { GeoNotice } from "@/components/ui";

const STEPS = [
  {
    who: "Companies",
    title: "Commit a share of profit",
    body: "Prove you own the business (DNS and the GLEIF registry), sign the profit-share agreement on-chain, and open a fixed-price raise.",
  },
  {
    who: "Investors",
    title: "Invest at a fixed price",
    body: "Prove non-US residence with a zero-knowledge proof, then put USDC into escrow. If the minimum isn't reached, it comes back automatically.",
  },
  {
    who: "Everyone",
    title: "Profit flows back as dollars",
    body: "Lock your tokens for a full period and receive the company's committed share of profit in USDC, pro-rata.",
  },
];

const CONTRAST: [string, string, string][] = [
  ["~1%", "of pump.fun tokens ever graduate", "0.63% (Sep 2025) to 1.89% (lifetime, May 2026)"],
  ["~60%", "of active pump.fun wallets lost money", "4.26M wallets over six months"],
  ["14.7×", "what the last curve buyer pays vs the first", "pump.fun's bonding curve. On dvdnd: 1×, everyone pays the same price"],
  ["~18%", "gross yield on a small business at ~4× profit", "at a 70% payout, before failures"],
];

export default function Home() {
  return (
    <main>
      <LandingFilm />

      <section className="page">
        <div className="label">How it works</div>
        <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", borderTop: "2px solid var(--line)" }}>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ padding: "20px 20px 24px 0", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="label">
                {String(i + 1).padStart(2, "0")} · {s.who}
              </div>
              <h3 className="h2">{s.title}</h3>
              <p className="muted">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="label" style={{ marginTop: 24 }}>
          Why not the memecoin meta
        </div>
        <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", borderTop: "2px solid var(--line)" }}>
          {CONTRAST.map(([n, label, note], i) => (
            <div key={label} style={{ padding: "20px 20px 24px 0", display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="num" style={{ fontSize: 40, lineHeight: 1, color: i === 3 ? "var(--green)" : undefined }}>
                {n}
              </div>
              <div style={{ fontWeight: 600 }}>{label}</div>
              <div className="small">{note}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <Link href="/discover" className="btn btn-primary btn-wide">
            Discover raises
          </Link>
          <Link href="/signin" className="btn btn-secondary btn-wide">
            Raise for your company
          </Link>
          <Link href="/simulation" className="btn btn-link">
            See the simulation →
          </Link>
        </div>
        <GeoNotice />
        <p className="small">
          Testnet demo on Stellar. Sources for the figures above are in the project&apos;s research report on GitHub.
        </p>
      </section>
    </main>
  );
}
