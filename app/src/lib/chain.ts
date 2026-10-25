// Typed reads and writes for the dvdnd contracts.

import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { CONTRACTS, UNIT } from "./config";
import { invoke, read, type Signer } from "./stellar";

// ── ScVal helpers ─────────────────────────────────────────────────────
export const sc = {
  address: (s: string) => new Address(s).toScVal(),
  u32: (n: number) => nativeToScVal(n, { type: "u32" }),
  u64: (n: bigint | number) => nativeToScVal(BigInt(n), { type: "u64" }),
  i128: (n: bigint) => nativeToScVal(n, { type: "i128" }),
  u256: (n: bigint) => nativeToScVal(n, { type: "u256" }),
  string: (s: string) => nativeToScVal(s, { type: "string" }),
  bytes: (b: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b)),
};

export const toUnits = (amount: number) => BigInt(Math.round(amount * 1e7));
export const fromUnits = (units: bigint | number) => Number(units) / Number(UNIT);

// ── registry ──────────────────────────────────────────────────────────
export enum CompanyStatus {
  Pending = 0,
  Verified = 1,
  Active = 2,
  Suspended = 3,
}

export type Company = {
  id: number;
  owner: string;
  name: string;
  country: number;
  profile_uri: string;
  status: CompanyStatus;
  kyb_hash?: Uint8Array;
  agreement_hash?: Uint8Array;
  payout_bps: number;
  period_secs: bigint;
};

/** Off-chain profile. New companies store it on-chain as a data: URI in `profile_uri`. */
export type Profile = {
  sector: string;
  city: string;
  description: string;
  website?: string;
  /** Legal Entity Identifier, checked against GLEIF during verification. */
  lei?: string;
  /** Last full year net profit in USD. */
  netProfit: number;
  code?: string;
};

export async function getCompany(id: number): Promise<Company> {
  const c = await read<Company>(CONTRACTS.registry, "company", [sc.u32(id)]);
  return { ...c, id: Number(c.id), country: Number(c.country), status: Number(c.status), payout_bps: Number(c.payout_bps) };
}

export async function companyCount(): Promise<number> {
  return Number(await read<number>(CONTRACTS.registry, "count"));
}

export function parseProfile(company: Pick<Company, "name" | "profile_uri">): Profile {
  const uri = company.profile_uri;
  if (uri.startsWith("data:application/json;base64,")) {
    try {
      return JSON.parse(atob(uri.slice("data:application/json;base64,".length)));
    } catch {
      /* fall through */
    }
  }
  return KNOWN_PROFILES[company.name] ?? { sector: "Business", city: "", description: "", netProfit: 0 };
}

export function encodeProfile(p: Profile) {
  return "data:application/json;base64," + btoa(JSON.stringify(p));
}

// Profiles for the companies onboarded by the testnet scripts before the
// app could write data: URIs. Profits are at testnet demo scale, matching
// the 1,000 USDC raises, so the target yield reads 18%.
const KNOWN_PROFILES: Record<string, Profile> = {
  "Andes Craft Brewing": {
    sector: "Beverages",
    city: "Valparaíso",
    description:
      "Independent craft brewery with a taproom and regional distribution across central Chile. Profitable since 2021.",
    netProfit: 360,
    code: "ANDES",
  },
  "Harbor & Hearth Bakeries": {
    sector: "Food",
    city: "Lisbon",
    description:
      "Four neighbourhood bakeries in Lisbon baking daily bread and pastry, with a wholesale line for cafés.",
    netProfit: 360,
    code: "HARBOR",
  },
};

// ── offering ──────────────────────────────────────────────────────────
export enum RaiseState {
  Open = 0,
  Succeeded = 1,
  Failed = 2,
}

export type Raise = {
  id: number;
  company_id: number;
  company: string;
  token: string;
  price: bigint;
  min_raise: bigint;
  max_raise: bigint;
  deadline: bigint;
  raised: bigint;
  investors: number;
  state: RaiseState;
  fee_paid: bigint;
};

export async function getRaise(id: number): Promise<Raise> {
  const r = await read<Raise>(CONTRACTS.offering, "raise", [sc.u32(id)]);
  return {
    ...r,
    id: Number(r.id),
    company_id: Number(r.company_id),
    investors: Number(r.investors),
    state: Number(r.state),
  };
}

export async function raiseCount(): Promise<number> {
  return Number(await read<number>(CONTRACTS.offering, "raise_count"));
}

export async function contribution(raiseId: number, investor: string): Promise<bigint> {
  return BigInt(await read(CONTRACTS.offering, "contribution", [sc.u32(raiseId), sc.address(investor)]));
}

/** A raise joined with its company and profile, ready for the UI. */
export type Listing = {
  raise: Raise;
  company: Company;
  profile: Profile;
};

export async function listListings(): Promise<Listing[]> {
  const n = await raiseCount();
  const ids = Array.from({ length: n }, (_, i) => i + 1);
  const raises = await Promise.all(ids.map(getRaise));
  const listings = await Promise.all(
    raises.map(async (raise) => {
      const company = await getCompany(raise.company_id);
      return { raise, company, profile: parseProfile(company) };
    }),
  );
  // Suspended companies (e.g. test runs, or removed by the platform) are hidden.
  return listings.filter((l) => l.company.status !== CompanyStatus.Suspended);
}

export async function getListing(raiseId: number): Promise<Listing> {
  const raise = await getRaise(raiseId);
  const company = await getCompany(raise.company_id);
  return { raise, company, profile: parseProfile(company) };
}

export const offering = {
  invest: (s: Signer, raiseId: number, amount: bigint) =>
    invoke(s, CONTRACTS.offering, "invest", [sc.u32(raiseId), sc.address(s.publicKey), sc.i128(amount)]),
  finalize: (s: Signer, raiseId: number) => invoke(s, CONTRACTS.offering, "finalize", [sc.u32(raiseId)]),
  claimTokens: (s: Signer, raiseId: number) =>
    invoke(s, CONTRACTS.offering, "claim_tokens", [sc.u32(raiseId), sc.address(s.publicKey)]),
  refund: (s: Signer, raiseId: number) =>
    invoke(s, CONTRACTS.offering, "refund", [sc.u32(raiseId), sc.address(s.publicKey)]),
  authorizeHolder: (s: Signer, raiseId: number) =>
    invoke(s, CONTRACTS.offering, "authorize_holder", [sc.u32(raiseId), sc.address(s.publicKey)]),
};

// ── gate ──────────────────────────────────────────────────────────────
export const gate = {
  verifyAndRegister: (
    s: Signer,
    p: { proof: { a: Uint8Array; b: Uint8Array; c: Uint8Array }; root: bigint; now: number; nullifier: bigint; scope: bigint },
  ) =>
    invoke(s, CONTRACTS.gate, "verify_and_register", [
      sc.address(s.publicKey),
      // Struct fields are encoded as a map with keys in sorted order.
      xdr.ScVal.scvMap(
        (["a", "b", "c"] as const).map(
          (k) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: sc.bytes(p.proof[k]) }),
        ),
      ),
      sc.u256(p.root),
      sc.u64(p.now),
      sc.u256(p.nullifier),
      sc.u256(p.scope),
    ]),
};

export async function eligibleUntil(investor: string): Promise<number> {
  return Number(await read(CONTRACTS.gate, "eligible_until", [sc.address(investor)]));
}

// ── vault ─────────────────────────────────────────────────────────────
export type Position = { active: bigint; pending: bigint; pending_from: number; debt: bigint; owed: bigint };
export type Pool = {
  period: number;
  acc: bigint;
  active_total: bigint;
  pending_total: bigint;
  total_distributed: bigint;
  last_distribution: bigint;
};

export async function position(token: string, holder: string): Promise<Position> {
  const p = await read<Position>(CONTRACTS.vault, "position", [sc.address(token), sc.address(holder)]);
  return { ...p, pending_from: Number(p.pending_from) };
}

export async function pool(token: string): Promise<Pool> {
  const p = await read<Pool>(CONTRACTS.vault, "pool", [sc.address(token)]);
  return { ...p, period: Number(p.period) };
}

export const vault = {
  lock: (s: Signer, token: string, amount: bigint) =>
    invoke(s, CONTRACTS.vault, "lock", [sc.address(token), sc.address(s.publicKey), sc.i128(amount)]),
  unlock: (s: Signer, token: string, amount: bigint) =>
    invoke(s, CONTRACTS.vault, "unlock", [sc.address(token), sc.address(s.publicKey), sc.i128(amount)]),
  claim: (s: Signer, token: string) =>
    invoke(s, CONTRACTS.vault, "claim", [sc.address(token), sc.address(s.publicKey)]),
  startPeriod: (s: Signer, token: string) => invoke(s, CONTRACTS.vault, "start_period", [sc.address(token)]),
  distribute: (s: Signer, token: string, amount: bigint) =>
    invoke(s, CONTRACTS.vault, "distribute", [sc.address(token), sc.address(s.publicKey), sc.i128(amount)]),
};

// ── tokens ────────────────────────────────────────────────────────────
export async function tokenBalance(token: string, holder: string): Promise<bigint> {
  return BigInt(await read(token, "balance", [sc.address(holder)]));
}

// ── derived numbers ───────────────────────────────────────────────────
/** Yearly dividend pool promised to holders, in USD. */
export const dividendPool = (l: Listing) => (l.profile.netProfit * l.company.payout_bps) / 10_000;

/** Target yield at the raise price: yearly dividend pool over the maximum raise. */
export const targetYield = (l: Listing) => {
  const max = fromUnits(l.raise.max_raise);
  return max > 0 ? dividendPool(l) / max : 0;
};

export type DisplayStatus = "Open" | "Funded" | "Refunding" | "Trading";

export function displayStatus(r: Raise, now = Date.now() / 1000): DisplayStatus {
  if (r.state === RaiseState.Succeeded) return "Trading";
  if (r.state === RaiseState.Failed) return "Refunding";
  const past = Number(r.deadline) <= now;
  if (r.raised >= r.min_raise && (past || r.raised === r.max_raise)) return "Funded";
  if (past) return "Refunding";
  return r.raised >= r.min_raise ? "Funded" : "Open";
}

export const ISO_COUNTRIES: Record<number, { name: string; cc: string }> = {
  620: { name: "Portugal", cc: "PT" },
  152: { name: "Chile", cc: "CL" },
  233: { name: "Estonia", cc: "EE" },
  404: { name: "Kenya", cc: "KE" },
  250: { name: "France", cc: "FR" },
  276: { name: "Germany", cc: "DE" },
  724: { name: "Spain", cc: "ES" },
  484: { name: "Mexico", cc: "MX" },
  76: { name: "Brazil", cc: "BR" },
  566: { name: "Nigeria", cc: "NG" },
  826: { name: "United Kingdom", cc: "GB" },
  840: { name: "United States", cc: "US" },
};

export const countryName = (n: number) => ISO_COUNTRIES[n]?.name ?? `Country ${n}`;
export const countryCode = (n: number) => ISO_COUNTRIES[n]?.cc ?? "··";

export const initials = (name: string) =>
  name
    .replace(/&/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

// ── readable contract errors ──────────────────────────────────────────
const CONTRACT_ERRORS: Record<string, Record<number, string>> = {
  offering: {
    1: "This company isn't active on dvdnd.",
    3: "Those raise terms aren't valid.",
    5: "This raise is no longer open.",
    6: "Verify your residence before investing.",
    7: "That would take the raise over its maximum.",
    8: "This raise can't close yet: it isn't full and the deadline hasn't passed.",
    9: "There's nothing to claim for this wallet.",
    10: "This raise isn't in the right state for that.",
  },
  vault: {
    1: "Enter an amount above zero.",
    2: "You don't have that many tokens locked.",
    3: "No tokens are locked for a full period yet, so there's no one to pay.",
    4: "A dividend period is already running.",
  },
  gate: {
    3: "The credential tree changed; please try again.",
    4: "Your clock is off; the proof's timestamp was rejected.",
    5: "This credential has already been used by another wallet.",
    6: "The proof didn't verify.",
  },
};

/** A sentence for the person, from an error thrown by a contract call. */
export function errorText(e: unknown, contract: keyof typeof CONTRACT_ERRORS): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = msg.match(/error (\d+)\)/)?.[1];
  return (code && CONTRACT_ERRORS[contract]?.[Number(code)]) || msg;
}
