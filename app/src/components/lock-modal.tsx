"use client";

import { useState } from "react";
import { Modal, ReceiptRow } from "./modal";
import { Toast, TxLink, fmt } from "./ui";
import { errorText, toUnits, vault } from "@/lib/chain";
import type { Holding } from "@/lib/portfolio";
import { useWallet } from "@/lib/wallet";

export function LockModal({ holding, mode, onClose, onDone }: { holding: Holding; mode: "lock" | "unlock"; onClose: () => void; onDone: () => void }) {
  const { signer } = useWallet();
  const investor = signer.investor!;
  const max = mode === "lock" ? holding.wallet : holding.locked + holding.pending;
  const [amount, setAmount] = useState(String(max));
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string>();
  const value = Number(amount);
  const name = holding.listing.company.name;
  const nothingEarningYet = holding.pool.active_total === 0n;

  async function submit() {
    setState("busy");
    setError(null);
    try {
      const fn = mode === "lock" ? vault.lock : vault.unlock;
      const res = await fn(investor, holding.listing.raise.token, toUnits(value));
      setHash(res.hash);
      setState("done");
      onDone();
    } catch (e) {
      setError(errorText(e, "vault"));
      setState("idle");
    }
  }

  return (
    <Modal title={`${mode === "lock" ? "Lock" : "Unlock"} ${name} tokens`} onClose={onClose}>
      {state === "done" ? (
        <>
          <Toast kind="ok" title={`${fmt(value)} tokens ${mode === "lock" ? "locked" : "unlocked"}`}>
            {hash && <TxLink hash={hash} />}
          </Toast>
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={onClose}>
            Close
          </button>
        </>
      ) : (
        <>
          <label className="field">
            <span>Amount to {mode}</span>
            <span className="input-wrap" data-error={value > max}>
              <input id="lockAmount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span className="input-suffix">tokens</span>
            </span>
            <span className="small" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {fmt(max)} {mode === "lock" ? "unlocked" : "locked"} available
              </span>
              <button type="button" className="btn-link" style={{ border: 0, background: "none", cursor: "pointer", font: "inherit" }} onClick={() => setAmount(String(max))}>
                Max
              </button>
            </span>
          </label>
          {mode === "lock" ? (
            <>
              <div>
                <ReceiptRow label="Current period">{holding.pool.period === 0 ? "Not started" : `Period ${holding.pool.period}`}</ReceiptRow>
                <ReceiptRow label="Starts earning">{nothingEarningYet ? "When the first period starts" : "Next period"}</ReceiptRow>
              </div>
              <div style={{ display: "flex", gap: 10, background: "var(--amber-soft)", padding: 12, fontSize: 13 }}>
                <span style={{ width: 3, background: "var(--amber)", flex: "none" }} />
                <span>
                  Only tokens locked for a whole period share that period&apos;s dividend. Tokens you lock now start
                  earning from the next period. You can unlock at any time, but tokens unlocked mid-period earn nothing
                  for it.
                </span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 10, background: "var(--amber-soft)", padding: 12, fontSize: 13 }}>
              <span style={{ width: 3, background: "var(--amber)", flex: "none" }} />
              <span>Unlocked tokens earn nothing for the current period. Dividends you&apos;ve already earned stay claimable.</span>
            </div>
          )}
          {error && <Toast kind="error" title="That didn't go through">{error}</Toast>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={state === "busy" || !(value > 0) || value > max} onClick={submit}>
              {state === "busy" ? "Waiting for Stellar…" : `${mode === "lock" ? "Lock" : "Unlock"} ${fmt(value || 0)} tokens`}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
