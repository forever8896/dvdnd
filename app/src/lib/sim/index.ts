// Runs the same trader population through both markets and summarises who
// makes money. Pure and seeded: the same parameters always give the same run.

import { runDividend } from "./dividend";
import { runMeme } from "./meme";
import { population } from "./population";
import { createRng, type Rng } from "./rng";
import type { Comparator, HeatCell, SimParams, SimResult, Summary, TraderResult, TraderType } from "./types";

export * from "./types";

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

/** Gini of end value per $1 put in, so wallet size doesn't count. */
function gini(values: number[]) {
  const v = values.map((x) => Math.max(0, x)).sort((a, b) => a - b);
  const n = v.length;
  const total = v.reduce((s, x) => s + x, 0);
  if (!n || !total) return 0;
  let weighted = 0;
  v.forEach((x, i) => (weighted += (i + 1) * x));
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

/** Share of all end value held by the bottom 0%, 5%, … 100% of participants. */
function lorenz(values: number[]) {
  const v = values.map((x) => Math.max(0, x)).sort((a, b) => a - b);
  const total = v.reduce((s, x) => s + x, 0) || 1;
  const cum = [0];
  v.forEach((x) => cum.push(cum[cum.length - 1] + x));
  return Array.from({ length: 21 }, (_, i) => cum[Math.round((v.length * i) / 20)] / total);
}

export function summarise(rows: TraderResult[]): Summary {
  const r = rows.map((t) => t.pnl / t.invested).sort((a, b) => a - b);
  return {
    medianReturn: quantile(r, 0.5),
    meanReturn: r.reduce((s, x) => s + x, 0) / (r.length || 1),
    lossShare: r.filter((x) => x < 0).length / (r.length || 1),
    p1: quantile(r, 0.01),
    p99: quantile(r, 0.99),
    gini: gini(rows.map((t) => 1 + t.pnl / t.invested)),
    participants: rows.length,
  };
}

/** Annualised return of a total return over `years`. */
export const annualise = (total: number, years: number) => Math.sign(1 + total) * Math.pow(Math.max(0, 1 + total), 1 / years) - 1;

/** Reference profiles from the brief's comparators (modelled distributions). */
function comparators(p: SimParams, rng: Rng): Comparator[] {
  const n = 2000;
  const realestate = Array.from({ length: n }, () => {
    const yieldPa = 0.03 + rng.next() * 0.11;
    // Secondary prices are often 50–85% of issue, sometimes at par.
    const exit = rng.chance(0.7) ? 0.5 + rng.next() * 0.35 : 0.85 + rng.next() * 0.2;
    return yieldPa * p.years + exit - 1;
  });
  const bdc = Array.from({ length: n }, () => {
    const yieldPa = 0.06 + rng.next() * 0.018;
    return yieldPa * p.years + rng.normal(0, 0.18 * Math.sqrt(p.years));
  });
  return [
    { key: "realestate", label: "Real-estate tokens", returns: realestate },
    { key: "bdc", label: "Listed BDC", returns: bdc },
  ];
}

export const HIST_EDGES = Array.from({ length: 31 }, (_, i) => Math.round((-1 + i * 0.1) * 10) / 10);

/** Share of samples per bin; the last bin also holds everything above +200%. */
function histogram(returns: number[]) {
  const bins = new Array(HIST_EDGES.length - 1).fill(0);
  for (const r of returns) bins[Math.min(bins.length - 1, Math.max(0, Math.floor((r + 1) / 0.1 + 1e-9)))]++;
  return bins.map((b) => b / (returns.length || 1));
}

export const HEAT_YIELDS = [0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.22, 0.25];
export const HEAT_FAILURES = [0, 0.03, 0.06, 0.09, 0.12, 0.15, 0.2];

/**
 * Median annual return of a locked holder who backs one raise at the raise
 * price and holds to the end, across target yields and failure rates. Many
 * independent positions with the same random draws per cell, so the surface
 * shows the effect of the two parameters rather than the luck of one run.
 */
function heatmap(p: SimParams): HeatCell[] {
  const periodYears = p.lockMonths / 12;
  const periods = Math.max(1, Math.floor((p.years * 12) / p.lockMonths));
  const n = 1500;
  const cells: HeatCell[] = [];
  for (const targetYield of HEAT_YIELDS)
    for (const failureRate of HEAT_FAILURES) {
      const rng = createRng(p.seed + 11);
      const pFail = 1 - Math.pow(1 - failureRate, periodYears);
      const pFraud = 1 - Math.pow(1 - p.fraudRate, periodYears);
      const r: number[] = [];
      for (let i = 0; i < n; i++) {
        // Yield on the raise price: the company's profit relative to its raise.
        let level = 1;
        let received = 0;
        let alive = true;
        const discount = 0.1 + rng.next() * 0.2;
        for (let k = 0; k < periods && alive; k++) {
          const fraud = rng.next() < pFraud;
          const fail = rng.next() < pFail;
          const recovery = rng.next() * 0.2;
          const shock = rng.normal(0.04 * periodYears, 0.25 * Math.sqrt(periodYears));
          if (fraud) alive = false;
          else if (fail) {
            alive = false;
            received += recovery;
          } else {
            level *= Math.exp(shock);
            received += targetYield * level * periodYears;
          }
        }
        if (alive) received += level * (1 - discount);
        r.push(annualise(received - 1, p.years));
      }
      cells.push({ targetYield, failureRate, medianIrr: quantile(r.sort((a, b) => a - b), 0.5) });
    }
  return cells;
}

const TYPES: TraderType[] = ["sniper", "momentum", "investor"];

export function runSimulation(p: SimParams): SimResult {
  const traders = population(p.traders, createRng(p.seed));
  const meme = runMeme(p, traders, createRng(p.seed + 1));
  const dividend = runDividend(p, traders, createRng(p.seed + 2));
  const comps = comparators(p, createRng(p.seed + 3));
  const ret = (rows: TraderResult[]) => rows.map((t) => t.pnl / t.invested);
  const byType = (rows: TraderResult[]) => Object.fromEntries(TYPES.map((t) => [t, summarise(rows.filter((r) => r.type === t))])) as Record<TraderType, Summary>;
  return {
    params: p,
    meme,
    dividend,
    summary: { meme: summarise(meme.traders), dividend: summarise(dividend.traders) },
    byType: { meme: byType(meme.traders), dividend: byType(dividend.traders) },
    lorenz: { meme: lorenz(ret(meme.traders).map((x) => 1 + x)), dividend: lorenz(ret(dividend.traders).map((x) => 1 + x)) },
    histogram: {
      edges: HIST_EDGES,
      meme: histogram(ret(meme.traders)),
      dividend: histogram(ret(dividend.traders)),
      realestate: histogram(comps[0].returns),
      bdc: histogram(comps[1].returns),
    },
    comparators: comps,
    heatmap: heatmap(p),
  };
}
