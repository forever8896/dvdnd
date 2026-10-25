// Thin client for reading and invoking dvdnd's Soroban contracts and for the
// few classic operations the app needs (trustlines, path payments).

import {
  Account,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";
import { NETWORK, USDC_ISSUER } from "./config";

export const server = new rpc.Server(NETWORK.rpcUrl);
export const horizon = new Horizon.Server(NETWORK.horizonUrl);
export const USDC = new Asset("USDC", USDC_ISSUER);

/** Something that can sign a transaction for one account. */
export type Signer = {
  publicKey: string;
  sign: (tx: Transaction) => Promise<Transaction>;
};

export function keypairSigner(kp: Keypair): Signer {
  return {
    publicKey: kp.publicKey(),
    sign: async (tx) => {
      tx.sign(kp);
      return tx;
    },
  };
}

export type TxResult = { hash: string; returnValue?: unknown };

export class TxError extends Error {
  constructor(
    message: string,
    public readonly hash?: string,
  ) {
    super(message);
  }
}

// Any existing account works as the source of a read-only simulation; nothing is signed or sent.
const READ_SOURCE = "GA2TYYT6HJ76EFLHAL5CXSDYAX3VND6XBTB6HLXHGQ4S3SMDWZYWDGS4";

/** Calls a contract function through simulation and returns the decoded result. */
export async function read<T = unknown>(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
  const tx = new TransactionBuilder(new Account(READ_SOURCE, "0"), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new TxError(explain(sim.error));
  return (sim.result?.retval ? scValToNative(sim.result.retval) : undefined) as T;
}

/** Invokes a contract function as `signer`, waits for the result and decodes the return value. */
export async function invoke(
  signer: Signer,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<TxResult> {
  const account = await server.getAccount(signer.publicKey);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK.passphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();
  let prepared: Transaction;
  try {
    prepared = (await server.prepareTransaction(tx)) as Transaction;
  } catch (e) {
    throw new TxError(explain(String(e)));
  }
  return submit(await signer.sign(prepared));
}

/** Builds, signs and submits classic operations for `signer`. */
export async function classic(signer: Signer, ops: xdr.Operation[]): Promise<TxResult> {
  const account = await server.getAccount(signer.publicKey);
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK.passphrase });
  ops.forEach((op) => builder.addOperation(op));
  const tx = builder.setTimeout(60).build();
  return submit(await signer.sign(tx));
}

async function submit(tx: Transaction): Promise<TxResult> {
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") throw new TxError("The network rejected the transaction.", sent.hash);
  for (let i = 0; i < 40; i++) {
    const res = await server.getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return {
        hash: sent.hash,
        returnValue: res.returnValue ? scValToNative(res.returnValue) : undefined,
      };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new TxError("The transaction failed on-chain.", sent.hash);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new TxError("Timed out waiting for confirmation.", sent.hash);
}

/** Funds a new testnet account with 10,000 XLM. */
export async function friendbot(publicKey: string) {
  const res = await fetch(`${NETWORK.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok && res.status !== 400) throw new TxError("Friendbot could not fund the account.");
}

export async function accountExists(publicKey: string) {
  try {
    await server.getAccount(publicKey);
    return true;
  } catch {
    return false;
  }
}

export type Balances = { xlm: number; usdc: number | null; assets: Record<string, number> };

/** Classic balances from Horizon. `usdc` is null when there is no USDC trustline. */
export async function balances(publicKey: string): Promise<Balances> {
  try {
    const acc = await horizon.loadAccount(publicKey);
    let xlm = 0;
    let usdc: number | null = null;
    const assets: Record<string, number> = {};
    for (const b of acc.balances) {
      if (b.asset_type === "native") xlm = Number(b.balance);
      else if ("asset_code" in b) {
        if (b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER) usdc = Number(b.balance);
        else assets[`${b.asset_code}:${b.asset_issuer}`] = Number(b.balance);
      }
    }
    return { xlm, usdc, assets };
  } catch {
    return { xlm: 0, usdc: null, assets: {} };
  }
}

/** XLM needed to buy exactly `usdc` USDC on the DEX right now (best path), or null if none. */
export async function quoteUsdcInXlm(usdc: number): Promise<number | null> {
  const res = await horizon.strictReceivePaths([Asset.native()], USDC, usdc.toFixed(7)).call();
  const best = res.records.map((r) => Number(r.source_amount)).sort((a, b) => a - b)[0];
  return best ?? null;
}

/** Buys exactly `usdc` USDC with XLM, adding the USDC trustline first if needed. */
export async function buyUsdc(signer: Signer, usdc: number): Promise<TxResult> {
  const quote = await quoteUsdcInXlm(usdc);
  if (quote === null) throw new TxError("No XLM→USDC liquidity on the testnet DEX right now.");
  const { usdc: current } = await balances(signer.publicKey);
  const list = [
    ...(current === null ? [ops.trustUsdc()] : []),
    Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: (quote * 1.02).toFixed(7), // 2% slippage allowance
      destination: signer.publicKey,
      destAsset: USDC,
      destAmount: usdc.toFixed(7),
      path: [],
    }),
  ];
  return classic(signer, list);
}

export const ops = {
  trustUsdc: () => Operation.changeTrust({ asset: USDC }),
  /** Swap XLM for at least `minUsdc` USDC through the DEX. */
  buyUsdc: (destination: string, xlm: string, minUsdc = "0.0000001") =>
    Operation.pathPaymentStrictSend({
      sendAsset: Asset.native(),
      sendAmount: xlm,
      destination,
      destAsset: USDC,
      destMin: minUsdc,
      path: [],
    }),
};

/** Turns contract error codes and RPC noise into a sentence a person can act on. */
function explain(raw: string): string {
  const m = raw.match(/Error\(Contract, #(\d+)\)/);
  if (m) return `Contract refused the request (error ${m[1]}).`;
  if (raw.includes("trustline entry is missing")) return "This account has no trustline for that asset yet.";
  if (raw.includes("resulting balance is not within the allowed range")) return "Not enough balance for this.";
  if (raw.includes("not authorized")) return "This account is not authorized to hold that token.";
  return raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
}

export { Keypair };
