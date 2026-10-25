export type TraderType = "sniper" | "momentum" | "investor";

export type Trader = {
  id: number;
  type: TraderType;
};

export type SimParams = {
  seed: number;
  traders: number;
  years: number;
  // Memecoin arm
  launches: number;
  /** Multiplies the number of sniper bots at each launch. 1 = calibrated default. */
  sniperIntensity: number;
  // Dividend arm
  companies: number;
  /** Yield investors are promised at the raise price, e.g. 0.18. */
  targetYield: number;
  /** Share of net profit committed to holders, e.g. 0.5. */
  payout: number;
  /** Lock period in months (3, 6 or 12). Dividends are paid once per period. */
  lockMonths: number;
  /** Yearly probability a listed company fails. */
  failureRate: number;
  /** Yearly probability a listed company stops paying through fraud or misreporting. */
  fraudRate: number;
  /** Flat listing fee per raise, in USD (never a share of the raise). */
  listingFee: number;
};

export const DEFAULT_PARAMS: SimParams = {
  seed: 42,
  traders: 2000,
  years: 3,
  launches: 600,
  sniperIntensity: 1,
  companies: 40,
  targetYield: 0.18,
  payout: 0.5,
  lockMonths: 12,
  failureRate: 0.07,
  fraudRate: 0.02,
  listingFee: 250,
};

/** Money flows in USD for the "where the money goes" chart. */
export type MoneyFlows = {
  toCompanies: number;
  toHoldersAsDividends: number;
  toPlatform: number;
  toSnipers: number;
  toCreators: number;
  lostByTraders: number;
};

export type TraderResult = {
  id: number;
  type: TraderType;
  invested: number;
  pnl: number;
};

export type SurvivalPoint = { days: number; share: number };

export type ArmResult = {
  traders: TraderResult[];
  flows: MoneyFlows;
  survival: SurvivalPoint[];
  totalVolume: number;
};

export type MemeResult = ArmResult & {
  launches: number;
  graduated: number;
  feesCheck: { sumPnl: number; fees: number };
};

export type PricePoint = {
  period: number;
  years: number;
  fairValue: number;
  price: number;
  dividend: number;
};

export type DividendResult = ArmResult & {
  raisesOpened: number;
  raisesFunded: number;
  capitalRaised: number;
  pricePath: PricePoint[];
};

export type Summary = {
  medianReturn: number;
  meanReturn: number;
  lossShare: number;
  p1: number;
  p99: number;
  gini: number;
  participants: number;
};

export type HeatCell = { targetYield: number; failureRate: number; medianIrr: number };

/** Reference return distributions for comparison (modelled, not simulated agents). */
export type Comparator = { key: "realestate" | "bdc"; label: string; returns: number[] };

export type SimResult = {
  params: SimParams;
  meme: MemeResult;
  dividend: DividendResult;
  summary: { meme: Summary; dividend: Summary };
  byType: Record<"meme" | "dividend", Record<TraderType, Summary>>;
  lorenz: { meme: number[]; dividend: number[] };
  histogram: { edges: number[]; meme: number[]; dividend: number[]; realestate: number[]; bdc: number[] };
  comparators: Comparator[];
  heatmap: HeatCell[];
};
