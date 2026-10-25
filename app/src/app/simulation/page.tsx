"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Bars, ChartCard, Heatmap, Legend, LineChart, SERIES, pct, usd, type SeriesKey } from "@/components/sim-charts";
import { annualise, DEFAULT_PARAMS, HEAT_FAILURES, HEAT_YIELDS, runSimulation, type SimParams, type Summary, type TraderType } from "@/lib/sim";
import { FEE } from "@/lib/sim/meme";
import { GATE_PASS } from "@/lib/sim/dividend";

type Control = { key: keyof SimParams; label: string; min: number; max: number; step: number; format: (v: number) => string; hint?: string };

const MARKET: Control[] = [
  { key: "targetYield", label: "Target yield at the raise price", min: 0.1, max: 0.25, step: 0.01, format: (v) => pct(v), hint: "Sets the price: raise = payout × profit ÷ yield" },
  { key: "payout", label: "Share of profit paid out", min: 0.25, max: 0.9, step: 0.05, format: (v) => pct(v) },
  { key: "failureRate", label: "Companies failing a year", min: 0, max: 0.2, step: 0.01, format: (v) => pct(v), hint: "6–8% for vetted firms, 10% young" },
  { key: "fraudRate", label: "Fraud or misreporting a year", min: 0, max: 0.06, step: 0.005, format: (v) => pct(v, 1) },
  { key: "listingFee", label: "Flat listing fee per raise", min: 0, max: 2000, step: 50, format: (v) => `$${v}` },
  { key: "sniperIntensity", label: "Sniper bots per launch", min: 0, max: 4, step: 0.25, format: (v) => `${v}×` },
];
const SIZE: Control[] = [
  { key: "traders", label: "Traders", min: 500, max: 4000, step: 250, format: (v) => String(v) },
  { key: "companies", label: "Companies", min: 10, max: 80, step: 5, format: (v) => String(v) },
  { key: "launches", label: "Memecoin launches", min: 100, max: 1500, step: 50, format: (v) => String(v) },
  { key: "years", label: "Years", min: 1, max: 5, step: 1, format: (v) => `${v}` },
];

const TYPE_LABEL: Record<TraderType, string> = { sniper: "Snipers", momentum: "Momentum traders", investor: "Yield investors" };

function Slider({ c, value, set }: { c: Control; value: number; set: (v: number) => void }) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{c.label}</span>
        <b className="num">{c.format(value)}</b>
      </span>
      <input type="range" min={c.min} max={c.max} step={c.step} value={value} onChange={(e) => set(Number(e.target.value))} />
      {c.hint && <span className="small">{c.hint}</span>}
    </label>
  );
}

function Headline({ arm, s, extra }: { arm: SeriesKey; s: Summary; extra: { label: string; value: string }[] }) {
  return (
    <div className="headline">
      <div className="headline-name">
        <i style={{ background: SERIES[arm].color }} />
        {SERIES[arm].label}
      </div>
      <div className="headline-grid">
        <div>
          <div className="label">Median return</div>
          <div className={`num headline-big ${s.medianReturn < 0 ? "red" : ""}`}>{pct(s.medianReturn, 1)}</div>
        </div>
        <div>
          <div className="label">Chance of a loss</div>
          <div className="num headline-big">{pct(s.lossShare)}</div>
        </div>
        {extra.map((e) => (
          <div key={e.label}>
            <div className="label">{e.label}</div>
            <div className="num headline-mid">{e.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Simulation() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const deferred = useDeferredValue(params);
  // Runs in the browser only: float math differs slightly between engines, so
  // a server render would never match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const r = useMemo(() => (mounted ? runSimulation(deferred) : null), [deferred, mounted]);
  if (!r)
    return (
      <main className="page sim" style={{ maxWidth: 1320 }}>
        <div className="label">Simulation</div>
        <h1 className="h1">Same traders, two kinds of market</h1>
        <div className="skeleton" style={{ height: 480 }} />
      </main>
    );
  const stale = deferred !== params;
  const set = (key: keyof SimParams) => (v: number) => setParams((p) => ({ ...p, [key]: v }));
  const years = r.params.years;

  const hist = (key: "dividend" | "meme" | "realestate" | "bdc") => ({
    key,
    points: r.histogram[key].map((y, i) => ({ x: r.histogram.edges[i] + 0.05, y })),
  });
  const histLines = (["dividend", "meme", "realestate", "bdc"] as const).map(hist);
  const fmtBin = (x: number) => (x > 1.9 ? "≥ +190%" : `${x - 0.05 >= 0 ? "+" : ""}${Math.round((x - 0.05) * 100)}%`);

  const survX = [1, 7, 30, 90, 180, 365, 730, 1095, 1460, 1825].filter((d) => d <= years * 365);
  const surv = (key: "meme" | "dividend") => ({ key, points: r[key].survival.map((s) => ({ x: Math.sqrt(s.days), y: s.share })) });
  const lorenzLines = (["dividend", "meme"] as const).map((key) => ({ key, points: r.lorenz[key].map((y, i) => ({ x: i / 20, y })) }));
  const price = r.dividend.pricePath;
  const heat = (y: number, f: number) => r.heatmap.find((c) => c.targetYield === y && c.failureRate === f)?.medianIrr ?? NaN;
  const nearest = (xs: number[], v: number) => xs.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const m = r.meme.flows;
  const d = r.dividend.flows;
  const lockerIrr = annualise(r.byType.dividend.investor.medianReturn, years);
  const check = r.meme.feesCheck.sumPnl + r.meme.feesCheck.fees;

  return (
    <main className="page sim" style={{ maxWidth: 1320 }}>
      <header style={{ maxWidth: 760 }}>
        <div className="label">Simulation</div>
        <h1 className="h1" style={{ marginTop: 6 }}>Same traders, two kinds of market</h1>
        <p className="muted" style={{ marginTop: 10 }}>
          {r.params.traders.toLocaleString()} traders (snipers, momentum traders and yield investors) trade a pump.fun-style memecoin market and
          dvdnd&apos;s fixed-price dividend raises over {years} {years === 1 ? "year" : "years"}. The asset is the only thing that changes. Move the
          sliders to stress the model; every run is seeded, so the same settings always give the same result.
        </p>
      </header>

      <div className="sim-layout">
        <aside className="sim-controls">
          <div className="label">Market</div>
          {MARKET.map((c) => (
            <Slider key={c.key} c={c} value={params[c.key] as number} set={set(c.key)} />
          ))}
          <div className="slider">
            <span className="slider-head"><span>Lock period (dividends paid per period)</span></span>
            <div className="seg seg-sm" role="group" aria-label="Lock period">
              {[3, 6, 12].map((mo) => (
                <button key={mo} aria-pressed={params.lockMonths === mo} onClick={() => set("lockMonths")(mo)}>{mo} mo</button>
              ))}
            </div>
          </div>
          <div className="label" style={{ marginTop: 8 }}>Size</div>
          {SIZE.map((c) => (
            <Slider key={c.key} c={c} value={params[c.key] as number} set={set(c.key)} />
          ))}
          <label className="slider">
            <span className="slider-head"><span>Random seed</span><b className="num">{params.seed}</b></span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => set("seed")(Math.floor(Math.random() * 1e6))}>New seed</button>
              <button className="btn btn-link btn-sm" onClick={() => setParams(DEFAULT_PARAMS)}>Reset all</button>
            </span>
          </label>
        </aside>

        <div className="sim-results" data-stale={stale}>
          <div className="headlines">
            <Headline
              arm="dividend"
              s={r.summary.dividend}
              extra={[
                { label: "To businesses", value: usd(d.toCompanies) },
                { label: "Paid to holders", value: usd(d.toHoldersAsDividends) },
                { label: "Raises funded", value: `${r.dividend.raisesFunded} of ${r.dividend.raisesOpened}` },
                { label: "Locker IRR (median)", value: `${pct(lockerIrr, 1)} / yr` },
              ]}
            />
            <Headline
              arm="meme"
              s={r.summary.meme}
              extra={[
                { label: "To businesses", value: "$0" },
                { label: "Fees taken", value: usd(m.toPlatform + m.toCreators) },
                { label: "Graduated", value: `${r.meme.graduated} of ${r.meme.launches}` },
                { label: "Sniper profit", value: usd(m.toSnipers) },
              ]}
            />
          </div>

          <ChartCard
            title="Who makes money: returns per trader"
            note={`Share of participants by total return over ${years} ${years === 1 ? "year" : "years"}. Real-estate tokens and a listed BDC are modelled from published yields and secondary discounts for comparison.`}
            table={
              <table className="table">
                <thead>
                  <tr><th>Return</th>{histLines.map((l) => <th key={l.key} className="r">{SERIES[l.key].label}</th>)}</tr>
                </thead>
                <tbody>
                  {r.histogram.edges.slice(0, -1).map((e, i) => (
                    <tr key={e}><td className="num">{fmtBin(e + 0.05)}</td>{histLines.map((l) => <td key={l.key} className="r num">{pct(l.points[i].y, 1)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <Legend keys={["dividend", "meme", "realestate", "bdc"]} />
            <LineChart lines={histLines} step xFormat={fmtBin} yFormat={(y) => pct(y)} xLabel="total return" xTicks={[-0.95, -0.45, 0.05, 0.55, 1.05, 1.55, 1.95]} />
          </ChartCard>

          <ChartCard
            title="Where the money goes"
            note="Dollars, one scale for both markets. In the memecoin market a trader's profit is another trader's loss, less fees; in dvdnd the money funds businesses and comes back as dividends."
            table={
              <table className="table">
                <thead><tr><th>Flow</th><th className="r">dvdnd raises</th><th className="r">Memecoins</th></tr></thead>
                <tbody>
                  {[
                    ["To businesses", d.toCompanies, m.toCompanies],
                    ["To holders as dividends and recoveries", d.toHoldersAsDividends, m.toHoldersAsDividends],
                    ["To the platform", d.toPlatform, m.toPlatform],
                    ["To token creators", d.toCreators, m.toCreators],
                    ["Sniper profit", d.toSnipers, m.toSnipers],
                    ["Lost by traders who lost", d.lostByTraders, m.lostByTraders],
                  ].map(([k, a, b]) => (
                    <tr key={k as string}><td>{k}</td><td className="r num">{usd(a as number)}</td><td className="r num">{usd(b as number)}</td></tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="flows">
              <div>
                <div className="flow-title"><i style={{ background: SERIES.dividend.color }} />dvdnd raises</div>
                <Bars
                  rows={[
                    { label: "To businesses", value: d.toCompanies, color: SERIES.dividend.color, note: "Capital from funded raises" },
                    { label: "To holders", value: d.toHoldersAsDividends, color: SERIES.dividend.color, note: "Dividends plus recoveries from failures" },
                    { label: "To the platform", value: d.toPlatform, color: SERIES.dividend.color, note: `$${r.params.listingFee} flat per raise opened` },
                    { label: "Lost by losers", value: d.lostByTraders, color: SERIES.dividend.color, note: "Failures, fraud, selling at a discount" },
                  ]}
                />
              </div>
              <div>
                <div className="flow-title"><i style={{ background: SERIES.meme.color }} />Memecoins</div>
                <Bars
                  rows={[
                    { label: "To businesses", value: 0, color: SERIES.meme.color },
                    { label: "To snipers", value: m.toSnipers, color: SERIES.meme.color, note: "Net profit of first-block bots" },
                    { label: "To the platform", value: m.toPlatform + m.toCreators, color: SERIES.meme.color, note: `${pct(FEE.platform + FEE.creator, 2)} of every trade` },
                    { label: "Lost by losers", value: m.lostByTraders, color: SERIES.meme.color, note: "Mostly late buyers holding at the end" },
                  ]}
                />
              </div>
            </div>
          </ChartCard>

          <ChartCard
            title="Returns by trader type"
            note="Fixed pricing removes the first-block edge: snipers pay the same price as everyone else, and the lock pays the people who hold."
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Trader</th><th>Market</th><th className="r">People</th><th className="r">Median</th><th className="r">Mean</th><th className="r">Loss chance</th><th className="r">1st pct</th><th className="r">99th pct</th><th className="r">Median IRR</th></tr>
                </thead>
                <tbody>
                  {(["sniper", "momentum", "investor"] as const).flatMap((t) =>
                    (["dividend", "meme"] as const).map((arm) => {
                      const s = r.byType[arm][t];
                      return (
                        <tr key={t + arm}>
                          <td>{arm === "dividend" ? TYPE_LABEL[t] : ""}</td>
                          <td><i className="dot" style={{ background: SERIES[arm].color }} />{SERIES[arm].label}</td>
                          <td className="r num">{s.participants}</td>
                          <td className={`r num ${s.medianReturn < 0 ? "red" : ""}`}>{pct(s.medianReturn, 1)}</td>
                          <td className="r num">{pct(s.meanReturn, 1)}</td>
                          <td className="r num">{pct(s.lossShare)}</td>
                          <td className="r num">{pct(s.p1)}</td>
                          <td className="r num">{pct(s.p99)}</td>
                          <td className="r num">{s.participants ? pct(annualise(s.medianReturn, years), 1) : "—"}</td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>

          <ChartCard
            title="What a locked holder earns: target yield × failure rate"
            note={`Median yearly return of one position bought at the raise and held ${years} ${years === 1 ? "year" : "years"}, with ${pct(r.params.fraudRate, 1)} fraud a year, 0–20% recovery on failure and a 10–30% secondary discount at exit. Blue is a gain, red a loss.`}
            table={
              <table className="table">
                <thead><tr><th>Yield</th>{HEAT_FAILURES.map((f) => <th key={f} className="r">{pct(f)} fail</th>)}</tr></thead>
                <tbody>
                  {HEAT_YIELDS.map((y) => (
                    <tr key={y}><td className="num">{pct(y)}</td>{HEAT_FAILURES.map((f) => <td key={f} className="r num">{pct(heat(y, f), 1)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <Heatmap
              rows={HEAT_YIELDS}
              cols={HEAT_FAILURES}
              value={heat}
              rowLabel="Target yield"
              colLabel="Failure rate"
              rowFormat={(v) => pct(v)}
              colFormat={(v) => pct(v)}
              marker={{ row: nearest(HEAT_YIELDS, r.params.targetYield), col: nearest(HEAT_FAILURES, r.params.failureRate) }}
            />
          </ChartCard>

          <>
            <ChartCard
              title="Secondary price vs fair value"
              note="Average per $1 token across funded raises (failed ones count as zero). Fair value is the trailing dividend at the target yield; the order book trades at a discount."
              table={
                <table className="table">
                  <thead><tr><th>Year</th><th className="r">Fair value</th><th className="r">Price</th><th className="r">Dividend</th></tr></thead>
                  <tbody>
                    {price.map((p) => (
                      <tr key={p.period}><td className="num">{p.years.toFixed(2)}</td><td className="r num">${p.fairValue.toFixed(2)}</td><td className="r num">${p.price.toFixed(2)}</td><td className="r num">${p.dividend.toFixed(3)}</td></tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <Legend keys={[]} extra={<><span><i style={{ background: SERIES.dividend.color }} />Order-book price</span><span><i className="dash" />Fair value</span></>} />
              <LineChart
                lines={[
                  { key: "dividend", points: price.map((p) => ({ x: p.years, y: p.price })) },
                  { key: "fair", points: price.map((p) => ({ x: p.years, y: p.fairValue })), dashed: true },
                ]}
                xFormat={(x) => `${x.toFixed(x % 1 ? 1 : 0)}y`}
                yFormat={(y) => `$${y.toFixed(2)}`}
                xLabel="years"
                yDomain={[0, Math.max(1.4, ...price.map((p) => p.fairValue * 1.1))]}
              />
            </ChartCard>

            <ChartCard
              title="Still paying vs still trading"
              note="Share of funded companies still paying dividends, and of memecoins still trading. Time runs on a square-root scale so day one is visible."
              table={
                <table className="table">
                  <thead><tr><th>Day</th><th className="r">Companies paying</th><th className="r">Memecoins trading</th></tr></thead>
                  <tbody>
                    {r.dividend.survival.map((s, i) => (
                      <tr key={s.days}><td className="num">{s.days}</td><td className="r num">{pct(s.share)}</td><td className="r num">{pct(r.meme.survival[i]?.share ?? 0)}</td></tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <Legend keys={["dividend", "meme"]} />
              <LineChart lines={[surv("dividend"), surv("meme")]} xFormat={(x) => `${Math.round(x * x)}d`} yFormat={(y) => pct(y)} xLabel="days since launch" yDomain={[0, 1.05]} xTicks={survX.map(Math.sqrt)} />
            </ChartCard>
          </>

          <ChartCard
            title="How evenly the money ends up"
            note={`Lorenz curves of what each participant walks away with per $1 they put in, so the size of their wallet doesn't count. The further a curve sags below the diagonal, the more a few people take most of the gains. Gini: dvdnd ${r.summary.dividend.gini.toFixed(2)}, memecoins ${r.summary.meme.gini.toFixed(2)}.`}
            table={
              <table className="table">
                <thead><tr><th>Bottom share of people</th><th className="r">dvdnd raises</th><th className="r">Memecoins</th></tr></thead>
                <tbody>
                  {r.lorenz.dividend.map((v, i) => (
                    <tr key={i}><td className="num">{pct(i / 20)}</td><td className="r num">{pct(v, 1)}</td><td className="r num">{pct(r.lorenz.meme[i], 1)}</td></tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <Legend keys={["dividend", "meme"]} />
            <LineChart lines={lorenzLines} xFormat={(x) => pct(x)} yFormat={(y) => pct(y)} xLabel="share of participants, poorest first" yDomain={[0, 1]} reference={{ from: [0, 0], to: [1, 1], label: "perfect equality" }} />
          </ChartCard>

          <section className="sim-notes">
            <div>
              <h2 className="h3">Consistency check</h2>
              <p className="small" style={{ marginTop: 4 }}>
                Every memecoin token bought is sold back by the end, so the curve returns to its starting reserves and traders&apos; total P&amp;L must equal
                minus the fees: <span className="num">{usd(r.meme.feesCheck.sumPnl)}</span> + <span className="num">{usd(r.meme.feesCheck.fees)}</span> ={" "}
                <b className={`num ${Math.abs(check) < 1 ? "green" : "red"}`}>{usd(check)}</b> {Math.abs(check) < 1 ? "✓" : "✗"}
              </p>
            </div>
            <div>
              <h2 className="h3">Assumptions</h2>
              <ul className="small">
                <li>Curve: pump.fun virtual reserves (30 SOL, 1.073B tokens), {pct(FEE.platform + FEE.creator, 2)} fee, graduation at 85 SOL; graduation chance drawn from Beta(2, 180), about 1.1%. 79% of tokens are dead after day one.</li>
                <li>Companies: revenue lognormal (median $700k, σ 0.8), net margin 9% ± 6%, profit growth 4% ± 25% a year; raises need half their maximum or refund in full.</li>
                <li>{pct(GATE_PASS)} of traders pass the residence proof. Yield investors back a raise when its yield beats 8% plus a risk premium that rises with failure and fraud.</li>
                <li>Secondary trades happen at period ends at a 10–30% discount to fair value; positions left at the end are marked at that price. The comparators are modelled distributions, not agents.</li>
                <li>This is a model, not a forecast or investment advice. The figures it rests on are listed in the <Link href="/docs/simulation">docs</Link>.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
