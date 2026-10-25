import type { Rng } from "./rng";
import type { Trader, TraderType } from "./types";

/** Population mix used by both markets: the same people trade both assets. */
export const MIX: Record<TraderType, number> = { sniper: 0.04, momentum: 0.56, investor: 0.4 };

export function population(n: number, rng: Rng): Trader[] {
  const out: Trader[] = [];
  for (let id = 0; id < n; id++) {
    const r = rng.next();
    const type: TraderType = r < MIX.sniper ? "sniper" : r < MIX.sniper + MIX.momentum ? "momentum" : "investor";
    out.push({ id, type });
  }
  // At least one of each, so every type has a pool to draw from.
  (["sniper", "momentum", "investor"] as const).forEach((type, i) => {
    if (!out.some((t) => t.type === type) && out[i]) out[i].type = type;
  });
  return out;
}

export function byType(traders: Trader[]): Record<TraderType, Trader[]> {
  return {
    sniper: traders.filter((t) => t.type === "sniper"),
    momentum: traders.filter((t) => t.type === "momentum"),
    investor: traders.filter((t) => t.type === "investor"),
  };
}

/** Points in days at which survival curves are sampled. */
export function survivalDays(years: number): number[] {
  const end = Math.round(years * 365);
  const days = [0, 1, 2, 3, 5, 7, 14, 21, 30];
  for (let d = 45; d < end; d += 15) days.push(d);
  days.push(end);
  return days.filter((d, i, a) => d <= end && a.indexOf(d) === i);
}

/** Share of items whose end day is after each sample day. */
export function survival(endDays: number[], years: number) {
  const n = endDays.length || 1;
  return survivalDays(years).map((days) => ({ days, share: endDays.filter((e) => e > days).length / n }));
}
