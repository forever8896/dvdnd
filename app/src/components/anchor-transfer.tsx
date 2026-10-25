"use client";

import { useEffect, useState } from "react";
import { Toast, TxLink, fmt } from "./ui";
import { ANCHOR_DOMAIN, describe, payWithdrawal, signIn, start, status, type AnchorTx } from "@/lib/anchor";
import { balances, classic, ops, type Signer } from "@/lib/stellar";

/**
 * Bank deposits and withdrawals of USDC through a Stellar anchor (SEP-10 +
 * SEP-24). Signing in and opening the anchor's window are separate clicks:
 * browsers let one click open one pop-up, and some wallets sign in a pop-up.
 */
export function AnchorTransfer({ signer, onDone }: { signer: Signer; onDone?: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [tx, setTx] = useState<AnchorTx | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<string>();

  // Follow the transfer until it settles.
  useEffect(() => {
    if (!token || !tx || ["completed", "error", "expired", "refunded"].includes(tx.status)) return;
    const t = setInterval(async () => {
      try {
        const next = await status(token, tx.id);
        setTx(next);
        if (next.status === "completed") onDone?.();
      } catch {
        /* keep polling */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [token, tx, onDone]);

  if (!ANCHOR_DOMAIN) return null;

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      setToken(await signIn(signer));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function begin(kind: "deposit" | "withdraw") {
    // Opened inside the click so the browser allows it; the anchor's URL comes after.
    const win = window.open("about:blank", "anchor", "popup,width=520,height=760");
    setBusy(kind);
    setError(null);
    setPaid(undefined);
    try {
      // The anchor pays out to a USDC trustline, so make sure there is one.
      if ((await balances(signer.publicKey)).usdc === null) await classic(signer, [ops.trustUsdc()]);
      const { url, id } = await start(kind, token!, signer.publicKey);
      if (win) win.location.href = url;
      else window.open(url, "anchor");
      setTx(await status(token!, id));
    } catch (e) {
      win?.close();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function pay() {
    if (!tx) return;
    setBusy("pay");
    setError(null);
    try {
      setPaid((await payWithdrawal(signer, tx)).hash);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!token ? (
        <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy !== null} onClick={connect}>
          {busy === "connect" ? "Signing in…" : `Connect to ${ANCHOR_DOMAIN}`}
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => begin("deposit")}>
            {busy === "deposit" ? "Opening…" : "Deposit from bank"}
          </button>
          <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => begin("withdraw")}>
            {busy === "withdraw" ? "Opening…" : "Withdraw to bank"}
          </button>
        </div>
      )}
      {tx && (
        <Toast kind={tx.status === "completed" ? "ok" : tx.status.startsWith("pending") || tx.status === "incomplete" ? "pending" : "error"} title={`${tx.kind === "deposit" ? "Deposit" : "Withdrawal"}: ${describe(tx.status)}`}>
          {tx.amount_in && <>Amount {fmt(Number(tx.amount_in), 2)} · </>}
          {tx.more_info_url && (
            <a href={tx.more_info_url} target="_blank" rel="noreferrer">
              Details at the anchor ↗
            </a>
          )}
          {tx.stellar_transaction_id && <> · <TxLink hash={tx.stellar_transaction_id} /></>}
        </Toast>
      )}
      {tx?.kind === "withdrawal" && tx.status === "pending_user_transfer_start" && !paid && (
        <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy !== null} onClick={pay}>
          {busy === "pay" ? "Sending…" : `Send ${fmt(Number(tx.amount_in ?? 0), 2)} USDC to the anchor`}
        </button>
      )}
      {paid && <Toast kind="ok" title="USDC sent to the anchor"><TxLink hash={paid} /></Toast>}
      {error && <Toast kind="error" title="The anchor transfer didn't go through">{error}</Toast>}
    </div>
  );
}
