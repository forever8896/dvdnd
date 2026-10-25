// Read model for a raise's compliance console: who holds the share token (and
// whether they're frozen), and the audit log of compliance actions. Both come
// from Horizon, which keeps full history, rather than the RPC's week of events.

import { scValToNative, xdr } from "@stellar/stellar-sdk";
import { fromUnits, position, type Raise } from "./chain";
import { CONTRACTS, NETWORK } from "./config";
import { read } from "./stellar";

export type Holder = {
  account: string;
  /** Tokens in the wallet (can be clawed back). */
  wallet: number;
  /** Tokens locked in the dividend vault. */
  locked: number;
  /** The trustline is authorized; a frozen holder can't send or receive. */
  authorized: boolean;
};

export type ComplianceEntry = {
  action: "freeze" | "unfreeze" | "clawback" | "handover";
  holder?: string;
  amount?: number;
  reason?: string;
  by: string;
  at: string;
  hash: string;
};

type HorizonPage<T> = { _embedded?: { records: T[] }; _links?: { next?: { href: string } } };

async function pages<T>(first: string, limit = 50): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = first;
  for (let i = 0; url && i < limit; i++) {
    const body = (await (await fetch(url)).json()) as HorizonPage<T>;
    const records = body._embedded?.records ?? [];
    out.push(...records);
    url = records.length === 200 ? (body._links?.next?.href ?? null) : null;
  }
  return out;
}

/** The share token's classic asset, from its Stellar Asset Contract ("CODE:ISSUER"). */
export async function shareAsset(token: string) {
  const [code, issuer] = String(await read<string>(token, "name")).split(":");
  return { code: code!, issuer: issuer! };
}

/** Every account with a trustline to the raise's share token. */
export async function holders(raise: Raise): Promise<Holder[]> {
  const { code, issuer } = await shareAsset(raise.token);
  type Account = { account_id: string; balances: { asset_code?: string; asset_issuer?: string; balance: string; is_authorized?: boolean }[] };
  const accounts = await pages<Account>(`${NETWORK.horizonUrl}/accounts?asset=${code}:${issuer}&limit=200`);
  return Promise.all(
    accounts.map(async (a) => {
      const line = a.balances.find((b) => b.asset_code === code && b.asset_issuer === issuer)!;
      const pos = await position(raise.token, a.account_id).catch(() => null);
      return {
        account: a.account_id,
        wallet: Number(line.balance),
        locked: pos ? fromUnits(pos.active + pos.pending) : 0,
        authorized: Boolean(line.is_authorized),
      };
    }),
  );
}

const ACTIONS: Record<string, ComplianceEntry["action"]> = {
  freeze_holder: "freeze",
  unfreeze_holder: "unfreeze",
  clawback: "clawback",
  set_raise_compliance: "handover",
};

/** Compliance actions on this raise, newest first, from the given accounts' history. */
export async function auditLog(raise: Raise, accounts: string[]): Promise<ComplianceEntry[]> {
  type Op = {
    type: string;
    transaction_successful?: boolean;
    parameters?: { value: string }[];
    source_account: string;
    created_at: string;
    transaction_hash: string;
  };
  const ops = (
    await Promise.all([...new Set(accounts)].map((a) => pages<Op>(`${NETWORK.horizonUrl}/accounts/${a}/operations?order=desc&limit=200`, 10)))
  ).flat();
  const entries: ComplianceEntry[] = [];
  for (const op of ops) {
    if (op.type !== "invoke_host_function" || op.transaction_successful === false || !op.parameters) continue;
    const [contract, fn, ...args] = op.parameters.map((p) => scValToNative(xdr.ScVal.fromXDR(p.value, "base64")));
    const action = ACTIONS[String(fn)];
    if (contract !== CONTRACTS.offering || !action || Number(args[0]) !== raise.id) continue;
    const base = { action, by: op.source_account, at: op.created_at, hash: op.transaction_hash };
    if (action === "handover") entries.push({ ...base, holder: String(args[1]) });
    else if (action === "clawback") entries.push({ ...base, holder: String(args[1]), amount: fromUnits(BigInt(args[2] as bigint)), reason: String(args[3]) });
    else entries.push({ ...base, holder: String(args[1]), reason: String(args[2]) });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
