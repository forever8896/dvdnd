"use client";

// Money in and out through a Stellar anchor: SEP-10 to sign in with the
// wallet, SEP-24 for the anchor's hosted deposit and withdrawal flows. On
// testnet this is SDF's test anchor, which pays out Circle testnet USDC (the
// same asset the raises use). Endpoints come from the anchor's stellar.toml.

import { Buffer } from "buffer";
import { Asset, Memo, Operation, TransactionBuilder, type Transaction } from "@stellar/stellar-sdk";
import { IS_TESTNET, NETWORK, USDC_ISSUER } from "./config";
import { classic, type Signer } from "./stellar";

export const ANCHOR_DOMAIN = process.env.NEXT_PUBLIC_ANCHOR_DOMAIN || (IS_TESTNET ? "testanchor.stellar.org" : "");

type Toml = { WEB_AUTH_ENDPOINT: string; TRANSFER_SERVER_SEP0024: string; SIGNING_KEY: string };
let toml: Promise<Toml> | null = null;

/** The anchor's SEP-1 settings we need. */
function anchorToml(): Promise<Toml> {
  if (!toml) {
    toml = fetch(`https://${ANCHOR_DOMAIN}/.well-known/stellar.toml`)
      .then((r) => r.text())
      .then((text) => {
        const get = (k: string) => text.match(new RegExp(`^${k}\\s*=\\s*"([^"]+)"`, "m"))?.[1] ?? "";
        const t = { WEB_AUTH_ENDPOINT: get("WEB_AUTH_ENDPOINT"), TRANSFER_SERVER_SEP0024: get("TRANSFER_SERVER_SEP0024"), SIGNING_KEY: get("SIGNING_KEY") };
        if (!t.WEB_AUTH_ENDPOINT || !t.TRANSFER_SERVER_SEP0024) throw new Error("This anchor doesn't offer SEP-24.");
        return t;
      });
    toml.catch(() => (toml = null));
  }
  return toml;
}

/** SEP-10: the wallet signs the anchor's challenge transaction; returns a session token. */
export async function signIn(signer: Signer): Promise<string> {
  const t = await anchorToml();
  const challenge = (await (await fetch(`${t.WEB_AUTH_ENDPOINT}?account=${signer.publicKey}`)).json()) as { transaction?: string; error?: string };
  if (!challenge.transaction) throw new Error(challenge.error ?? "The anchor didn't send a sign-in challenge.");
  const tx = TransactionBuilder.fromXDR(challenge.transaction, NETWORK.passphrase) as Transaction;
  // A real challenge is a zero-sequence transaction from the anchor's signing key.
  if (tx.source !== t.SIGNING_KEY || tx.sequence !== "0") throw new Error("The anchor's sign-in challenge doesn't look right.");
  const signed = await signer.sign(tx);
  const res = (await (
    await fetch(t.WEB_AUTH_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction: signed.toXDR() }) })
  ).json()) as { token?: string; error?: string };
  if (!res.token) throw new Error(res.error ?? "The anchor didn't accept the sign-in.");
  return res.token;
}

export type AnchorTx = {
  id: string;
  kind: "deposit" | "withdrawal";
  status: string;
  amount_in?: string;
  amount_out?: string;
  more_info_url?: string;
  withdraw_anchor_account?: string;
  withdraw_memo?: string;
  withdraw_memo_type?: "text" | "id" | "hash";
  stellar_transaction_id?: string;
};

/** SEP-24: starts a hosted deposit or withdrawal of USDC; returns the anchor's page to open. */
export async function start(kind: "deposit" | "withdraw", token: string, account: string) {
  const t = await anchorToml();
  const res = await fetch(`${t.TRANSFER_SERVER_SEP0024}/transactions/${kind}/interactive`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ asset_code: "USDC", asset_issuer: USDC_ISSUER, account }),
  });
  const body = (await res.json()) as { url?: string; id?: string; error?: string };
  if (!body.url || !body.id) throw new Error(body.error ?? "The anchor couldn't start the transfer.");
  return { url: body.url, id: body.id };
}

export async function status(token: string, id: string): Promise<AnchorTx> {
  const t = await anchorToml();
  const body = (await (await fetch(`${t.TRANSFER_SERVER_SEP0024}/transaction?id=${id}`, { headers: { Authorization: `Bearer ${token}` } })).json()) as {
    transaction?: AnchorTx;
    error?: string;
  };
  if (!body.transaction) throw new Error(body.error ?? "The anchor didn't return the transfer.");
  return body.transaction;
}

/** For a withdrawal the anchor is ready for: send it the USDC with its memo. */
export function payWithdrawal(signer: Signer, tx: AnchorTx) {
  if (!tx.withdraw_anchor_account || !tx.amount_in) throw new Error("The anchor hasn't said where to send the USDC yet.");
  const memo =
    !tx.withdraw_memo ? Memo.none() : tx.withdraw_memo_type === "id" ? Memo.id(tx.withdraw_memo) : tx.withdraw_memo_type === "hash" ? Memo.hash(Buffer.from(tx.withdraw_memo, "base64").toString("hex")) : Memo.text(tx.withdraw_memo);
  return classic(signer, [Operation.payment({ destination: tx.withdraw_anchor_account, asset: new Asset("USDC", USDC_ISSUER), amount: Number(tx.amount_in).toFixed(7) })], memo);
}

/** Human status for the anchor's SEP-24 states. */
export function describe(s: string) {
  if (s === "completed") return "Completed";
  if (s === "pending_user_transfer_start") return "Waiting for you to send the USDC";
  if (s === "incomplete") return "Waiting for you to finish in the anchor's window";
  if (s.startsWith("pending")) return "The anchor is processing it";
  if (s === "error" || s === "expired" || s === "refunded") return `Stopped (${s})`;
  return s;
}
