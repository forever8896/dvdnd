// The memecoin arm: launches on a pump.fun-style constant-product bonding
// curve. Every token bought is sold back by the end of a launch, so the curve
// returns to its starting reserves and the traders' total P&L is exactly minus
// the fees: a closed-system check that the model doesn't create money.

import { byType, survival } from "./population";
import type { Rng } from "./rng";
import type { MemeResult, SimParams, Trader, TraderType } from "./types";

export const SOL_USD = 150;
/** pump.fun virtual reserves at launch. */
const VIRTUAL_SOL = 30;
const VIRTUAL_TOKENS = 1_073_000_000;
/** Real SOL in the curve at which a token graduates (~$69k market cap). */
const GRADUATION_SOL = 85;
export const FEE = { platform: 0.0095, creator: 0.003 };
const FEE_RATE = FEE.platform + FEE.creator;
const STEPS = 40;

type Position = { trader: Trader; tokens: number; solIn: number; solOut: number; entry: number; boughtAt: number; exitAt: number };

/** Mean ≈ 1.1%, as measured graduation rates of 0.63–1.89%. */
function beta2_180(rng: Rng) {
  // Beta(a, b) as the ratio of gamma draws; a sum of exponentials is Gamma(2).
  const gammaInt = (k: number) => {
    let s = 0;
    for (let i = 0; i < k; i++) s -= Math.log(1 - rng.next());
    return s;
  };
  const x = gammaInt(2);
  // Gamma(180) ≈ normal(180, √180).
  const y = Math.max(1, rng.normal(180, Math.sqrt(180)));
  return x / (x + y);
}

export function runMeme(p: SimParams, traders: Trader[], rng: Rng): MemeResult {
  const pools = byType(traders);
  const pnl = new Map<number, { invested: number; pnl: number }>();
  const book = (t: Trader) => {
    let r = pnl.get(t.id);
    if (!r) pnl.set(t.id, (r = { invested: 0, pnl: 0 }));
    return r;
  };
  const gradRate = beta2_180(rng);
  let graduated = 0;
  let fees = 0;
  let volumeSol = 0;
  const endDays: number[] = [];

  for (let l = 0; l < p.launches; l++) {
    let x = VIRTUAL_SOL;
    let y = VIRTUAL_TOKENS;
    const k = x * y;
    const price = () => x / y;
    const hyped = rng.chance(gradRate);
    let didGraduate = false;
    const open: Position[] = [];
    const closed: Position[] = [];

    const buy = (trader: Trader, sol: number, step: number) => {
      const fee = sol * FEE_RATE;
      const net = sol - fee;
      const nx = x + net;
      const out = y - k / nx;
      x = nx;
      y = k / nx;
      fees += fee;
      volumeSol += sol;
      const hold = trader.type === "sniper" ? 1 + rng.int(3) : trader.type === "momentum" ? 2 + rng.int(8) : STEPS;
      open.push({ trader, tokens: out, solIn: sol, solOut: 0, entry: sol / out, boughtAt: step, exitAt: step + hold });
      if (x - VIRTUAL_SOL >= GRADUATION_SOL) didGraduate = true;
    };
    const sell = (pos: Position) => {
      const ny = y + pos.tokens;
      const gross = x - k / ny;
      const fee = gross * FEE_RATE;
      y = ny;
      x = k / ny;
      fees += fee;
      volumeSol += gross;
      pos.solOut += gross - fee;
      pos.tokens = 0;
      closed.push(pos);
    };

    // Who arrives when: snipers in the first block, then waves of buyers.
    const arrivals: { step: number; trader: Trader; sol: number }[] = [];
    const snipers = rng.poisson(2.5 * p.sniperIntensity);
    for (let i = 0; i < snipers; i++) arrivals.push({ step: 0, trader: rng.pick(pools.sniper), sol: rng.lognormal(hyped ? 3 : 1.2, 0.6) });
    const wave = (type: TraderType, n: number, from: number, to: number, median: number) => {
      for (let i = 0; i < n; i++) arrivals.push({ step: from + rng.int(to - from), trader: rng.pick(pools[type]), sol: rng.lognormal(median, 0.9) });
    };
    if (hyped) {
      wave("momentum", rng.poisson(140), 1, 22, 0.9);
      wave("investor", rng.poisson(70), 4, 30, 0.6);
      // Rare second leg up after graduation (a fat right tail).
      if (rng.chance(0.15)) wave("momentum", Math.min(400, Math.round(rng.pareto(20, 1.6))), 28, 34, 0.9);
    } else {
      wave("momentum", rng.poisson(6), 1, 10, 0.35);
      wave("investor", rng.poisson(2), 2, 14, 0.25);
    }
    rng.shuffle(arrivals).sort((a, b) => a.step - b.step);

    let next = 0;
    for (let step = 0; step < STEPS; step++) {
      while (next < arrivals.length && arrivals[next].step === step) {
        const a = arrivals[next++];
        buy(a.trader, a.sol, step);
      }
      const px = price();
      for (let i = open.length - 1; i >= 0; i--) {
        const pos = open[i];
        if (pos.boughtAt === step) continue;
        const gain = px / pos.entry;
        const exit =
          pos.trader.type === "sniper"
            ? step >= pos.exitAt || gain >= 2
            : pos.trader.type === "momentum"
              ? step >= pos.exitAt || gain >= 1.8 || gain <= 0.7
              : gain <= 0.5 && rng.chance(0.2);
        if (exit) {
          open.splice(i, 1);
          sell(pos);
        }
      }
    }
    // Final liquidation: everyone still holding sells into what is left.
rng.shuffle(open).forEach(sell);

    for (const pos of closed) {
      const r = book(pos.trader);
      r.invested += pos.solIn * SOL_USD;
      r.pnl += (pos.solOut - pos.solIn) * SOL_USD;
    }
    if (didGraduate) graduated++;
    // 79% are dead after day one; the rest fade, graduates last longer.
    endDays.push(didGraduate ? rng.lognormal(45, 1.2) : rng.chance(0.79) ? rng.next() : 1 + rng.lognormal(4, 1));
  }

  const results = traders.filter((t) => pnl.has(t.id)).map((t) => ({ id: t.id, type: t.type, ...pnl.get(t.id)! }));
  const sumPnl = results.reduce((s, r) => s + r.pnl, 0);
  const feesUsd = fees * SOL_USD;
  const sniperPnl = results.filter((r) => r.type === "sniper").reduce((s, r) => s + r.pnl, 0);
  return {
    traders: results,
    launches: p.launches,
    graduated,
    feesCheck: { sumPnl, fees: feesUsd },
    totalVolume: volumeSol * SOL_USD,
    survival: survival(endDays, p.years),
    flows: {
      toCompanies: 0,
      toHoldersAsDividends: 0,
      toPlatform: (feesUsd * FEE.platform) / FEE_RATE,
      toCreators: (feesUsd * FEE.creator) / FEE_RATE,
      toSnipers: Math.max(0, sniperPnl),
      lostByTraders: -results.filter((r) => r.pnl < 0).reduce((s, r) => s + r.pnl, 0),
    },
  };
}
