import Link from "next/link";
import { Callout, Clip, DocHeader, DocPager } from "@/components/docs";

export const metadata = { title: "The simulation model" };

const ROWS: [string, string, string][] = [
  ["Bonding curve", "pump.fun virtual reserves (30 SOL, 1.073B tokens), 1.25% fee (0.95% platform, 0.3% creator), graduation at 85 SOL", "Published curve parameters; arXiv 2602.14860"],
  ["Graduation", "Beta(2, 180), mean about 1.1%", "Measured 0.63–1.89%"],
  ["Abandonment", "79% of tokens dead after day one", "Secondary summary"],
  ["Snipers", "About 2.5 bots per launch at intensity 1, selling within a few blocks or at 2×", "Assumption; slider"],
  ["Company revenue", "Lognormal, median $700k, σ 0.8", "BizBuySell median $692k (Q2 2026)"],
  ["Net margin", "Mean 9%, sd 6%, clipped to −5%…30%", "Damodaran ex-financials 8.56% (Jan 2026)"],
  ["Profit growth", "4% a year, volatility 25%", "Assumption"],
  ["Failure", "7% a year by default, 0–20% recovered", "BLS: 51.5% of businesses survive five years"],
  ["Fraud or misreporting", "2% a year, nothing recovered", "Stress variable"],
  ["Gate friction", "60% of traders complete the residence proof", "Assumption"],
  ["Investor hurdle", "8% plus a risk premium that grows with failure and fraud", "Assumption"],
  ["Secondary discount", "10–30% to fair value", "Private-share secondaries; RealT"],
];

export default function SimulationDocs() {
  return (
    <>
      <DocHeader slug="simulation" />
      <p>
        The <Link href="/simulation">simulation</Link> runs one population of traders through two markets: a pump.fun-style
        memecoin launchpad and dvdnd&apos;s fixed-price dividend raises. Only the asset changes. The question is who
        makes money, and whether real businesses get funded.
      </p>
      <Clip name="simulation" caption="Raising the yearly failure rate from 7% to 15%: dvdnd's median return turns negative, and the heatmap shows which target yields still pay." />

      <h2>Agents</h2>
      <ul>
        <li><b>Snipers</b> buy in the first block of a launch and dump quickly. At a fixed price they pay what everyone pays.</li>
        <li><b>Momentum traders</b> follow price, take profit at 1.8× and stop out at −30%.</li>
        <li><b>Yield investors</b> hold memecoins to the end. In dvdnd they back a raise when its yield beats their hurdle, then hold and collect dividends.</li>
      </ul>

      <h2>Assumptions and sources</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Parameter</th><th>Value</th><th>Basis</th></tr></thead>
          <tbody>
            {ROWS.map(([a, b, c]) => (
              <tr key={a}><td><b>{a}</b></td><td>{b}</td><td className="muted">{c}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Checks</h2>
      <ul>
        <li><b>Conservation.</b> Every memecoin token bought is sold back by the end of its launch, so the curve returns to its starting reserves. Traders&apos; total P&amp;L must equal minus the fees, and the page shows the check.</li>
        <li><b>Reproducibility.</b> Each run is seeded. The same settings always give the same result, and unit tests check both properties.</li>
        <li><b>Flat fee.</b> dvdnd&apos;s platform income is the listing fee times the raises opened, never a share of the money raised.</li>
      </ul>

      <h2>Limits</h2>
      <ul>
        <li>The memecoin arm is a sample of 100–1,500 launches, not the real 20,000+ a day. Shares and distributions are what matter, not totals.</li>
        <li>With a few dozen companies the dividend arm is lumpy: one failure moves the result. Try several seeds.</li>
        <li>Real-estate tokens and the listed BDC are modelled return distributions from published yields and discounts, not agents.</li>
        <li>Post-graduation trading stays on the curve rather than moving to an AMM, which keeps the conservation check exact.</li>
      </ul>
      <Callout title="A model, not a forecast" tone="warn">
        The simulation shows how the mechanisms behave under stated assumptions. It isn&apos;t a prediction of returns or
        investment advice.
      </Callout>
      <DocPager slug="simulation" />
    </>
  );
}
