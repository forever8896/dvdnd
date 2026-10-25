// The dividend arm: fixed-price, all-or-nothing raises by small companies that
// commit a share of profit to holders who stay locked for a full period.
// Everyone pays the same price, so there's no first-block edge; returns come
// from dividends, recoveries and the secondary price at the end.

import { byType, survival } from "./population";
import type { Rng } from "./rng";
import type { DividendResult, PricePoint, SimParams, Trader, TraderType } from "./types";

/** Share of traders who complete the residence proof and can invest. */
export const GATE_PASS = 0.6;
/** Base hurdle every yield investor wants before a risk premium. */
const HURDLE = 0.08;
/** The minimum is half the maximum; below it, everyone is refunded. */
const MIN_FILL = 0.5;
const GROWTH = { mean: 0.04, sd: 0.25 };

type Company = {
  profit: number;
  max: number;
  raised: number;
  alive: boolean;
  discount: number;
  /** Annual dividend per token from the last paying period. */
  trailing: number;
  /** Tokens held per trader id. 1 token = $1 at the raise. */
  holders: Map<number, number>;
  endDay: number;
};

type Account = { type: TraderType; budget: number; invested: number; received: number };

const BUDGET: Record<TraderType, [number, number]> = { sniper: [8000, 0.8], momentum: [1500, 1], investor: [5000, 1] };

export function runDividend(p: SimParams, traders: Trader[], rng: Rng): DividendResult {
  const periodYears = p.lockMonths / 12;
  const periods = Math.max(1, Math.floor((p.years * 12) / p.lockMonths));
  const accounts = new Map<number, Account>();
  const pools = byType(traders);

  // Companies with a profit to share open raises priced to the target yield.
  const companies: Company[] = [];
  let opened = 0;
  for (let i = 0; i < p.companies; i++) {
    const revenue = rng.lognormal(700_000, 0.8);
    const margin = Math.min(0.3, Math.max(-0.05, rng.normal(0.09, 0.06)));
    const profit = revenue * margin;
    if (profit <= 0) continue;
    opened++;
    companies.push({
      profit,
      max: (p.payout * profit) / p.targetYield,
      raised: 0,
      alive: true,
      discount: 0.1 + rng.next() * 0.2,
      trailing: p.payout * profit,
      holders: new Map(),
      endDay: p.years * 365 + 1,
    });
  }

  // Demand: who passes the gate and wants this yield, and how much they bring.
  // Investors want the hurdle plus a premium that grows with the risk they see.
  const perceivedRisk = 0.5 * (p.failureRate + p.fraudRate);
  const order = rng.shuffle([...traders]);
  for (const t of order) {
    if (!rng.chance(GATE_PASS)) continue;
    const wants =
      t.type === "investor" ? p.targetYield > HURDLE + perceivedRisk + Math.max(0, rng.normal(0.04, 0.03)) : t.type === "sniper" ? rng.chance(0.5) : rng.chance(0.25);
    if (!wants) continue;
    const [median, sigma] = BUDGET[t.type];
    const budget = Math.min(median * 20, rng.lognormal(median, sigma));
    const acct: Account = { type: t.type, budget, invested: 0, received: 0 };
    accounts.set(t.id, acct);
    // Raises open one after another; people back what is open right now.
    const open = companies.filter((c) => c.raised < c.max).slice(0, 3);
    if (!open.length) continue;
    const picks = 1 + rng.int(open.length);
    for (let i = 0; i < picks; i++) {
      const c = open[i];
      const amount = Math.min((budget * (t.type === "investor" ? 0.7 : 1)) / picks, c.max - c.raised);
      if (amount < 1) continue;
      c.raised += amount;
      c.holders.set(t.id, (c.holders.get(t.id) ?? 0) + amount);
    }
  }

  // All-or-nothing: raises under the minimum refund everyone in full.
  const funded = companies.filter((c) => c.raised >= c.max * MIN_FILL);
  for (const c of companies) {
    if (c.raised < c.max * MIN_FILL) continue;
    for (const [id, tokens] of c.holders) {
      const a = accounts.get(id)!;
      a.invested += tokens;
      a.budget -= tokens;
    }
  }
  let toHolders = 0;
  let volume = funded.reduce((s, c) => s + c.raised, 0);
  const capitalRaised = volume;
  const pricePath: PricePoint[] = [{ period: 0, years: 0, fairValue: 1, price: 1, dividend: 0 }];
  const pFail = 1 - Math.pow(1 - p.failureRate, periodYears);
  const pFraud = 1 - Math.pow(1 - p.fraudRate, periodYears);
  const buyers = pools.investor.filter((t) => accounts.has(t.id));
  const price = (c: Company) => (c.alive ? (c.trailing / c.raised / p.targetYield) * (1 - c.discount) : 0);

  for (let period = 1; period <= periods; period++) {
    let fvSum = 0;
    let pxSum = 0;
    let divSum = 0;
    for (const c of funded) {
      if (!c.alive) continue;
      const pay = (total: number) => {
        for (const [id, tokens] of c.holders) accounts.get(id)!.received += (total * tokens) / c.raised;
        toHolders += total;
      };
      if (rng.chance(pFraud)) {
        c.alive = false;
        c.endDay = (period - 1 + rng.next()) * periodYears * 365;
        continue;
      }
      if (rng.chance(pFail)) {
        c.alive = false;
        c.endDay = (period - 1 + rng.next()) * periodYears * 365;
        pay(c.raised * rng.next() * 0.2);
        continue;
      }
      c.profit *= Math.exp(rng.normal(GROWTH.mean * periodYears, GROWTH.sd * Math.sqrt(periodYears)));
      // Only holders locked for the whole period are paid; everyone here was.
      const dividend = p.payout * Math.max(0, c.profit) * periodYears;
      c.trailing = dividend / periodYears;
      pay(dividend);
      divSum += dividend / c.raised;
    }

    // Secondary market at the period end: traders sell to yield investors at
    // a discount to fair value. Investors sometimes sell for cash too.
    for (const c of funded) {
      if (!c.alive) continue;
      const px = price(c);
      fvSum += c.trailing / c.raised / p.targetYield;
      pxSum += px;
      if (period === periods) continue;
      for (const [id, tokens] of [...c.holders]) {
        const seller = accounts.get(id)!;
        if (seller.type === "investor" && !rng.chance(0.08)) continue;
        const buyerId = buyers.length ? rng.pick(buyers).id : -1;
        const buyer = accounts.get(buyerId);
        const cost = tokens * px;
        if (!buyer || buyerId === id || buyer.budget < cost) continue;
        buyer.budget -= cost;
        buyer.invested += cost;
        seller.received += cost;
        volume += cost;
        c.holders.delete(id);
        c.holders.set(buyerId, (c.holders.get(buyerId) ?? 0) + tokens);
      }
    }
    pricePath.push({ period, years: period * periodYears, fairValue: fvSum / funded.length || 0, price: pxSum / funded.length || 0, dividend: divSum / funded.length || 0 });
  }

  // Whatever is still held is marked at the secondary price.
  for (const c of funded) {
    const px = price(c);
    for (const [id, tokens] of c.holders) accounts.get(id)!.received += tokens * px;
  }

  const results = [...accounts].filter(([, a]) => a.invested > 0).map(([id, a]) => ({ id, type: a.type, invested: a.invested, pnl: a.received - a.invested }));
  return {
    traders: results,
    raisesOpened: opened,
    raisesFunded: funded.length,
    capitalRaised,
    pricePath,
    totalVolume: volume,
    survival: survival(
      funded.map((c) => c.endDay),
      p.years,
    ),
    flows: {
      toCompanies: capitalRaised,
      toHoldersAsDividends: toHolders,
      toPlatform: opened * p.listingFee,
      toSnipers: Math.max(0, results.filter((r) => r.type === "sniper").reduce((s, r) => s + r.pnl, 0)),
      toCreators: 0,
      lostByTraders: -results.filter((r) => r.pnl < 0).reduce((s, r) => s + r.pnl, 0),
    },
  };
}
