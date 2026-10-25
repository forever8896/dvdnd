"use client";

import { useEffect, useState } from "react";
import { buyUsdc, quoteUsdcInXlm, type Signer } from "@/lib/stellar";
import { Toast, TxLink, fmt } from "./ui";

/**
 * Testnet stand-in for a bank on-ramp: swaps test XLM for Circle's testnet
 * USDC with a path payment on Stellar's DEX. In production this is a
 * MoneyGram / regional anchor deposit (SEP-24).
 */
export function AddMoney({
  signer,
  suggested = 500,
  onDone,
}: {
  signer: Signer;
  suggested?: number;
  onDone?: () => void;
}) {
  const [amount, setAmount] = useState(String(suggested));
  const [quote, setQuote] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");
  const [hash, setHash] = useState<string>();
  const value = Number(amount);

  useEffect(() => {
    if (!(value > 0)) return setQuote(null);
    const t = setTimeout(() => {
      quoteUsdcInXlm(value).then(setQuote, () => setQuote(null));
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  async function add() {
    setState("busy");
    try {
      const res = await buyUsdc(signer, value);
      setHash(res.hash);
      setState("done");
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label className="field">
        <span>Add money</span>
        <span className="input-wrap">
          <input id="addMoneyAmount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="input-suffix">USDC</span>
        </span>
        <span className="small">
          {quote ? `Pays about ${fmt(quote, 2)} test XLM through Stellar's DEX (path payment).` : "Getting a price…"}
        </span>
      </label>
      <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={add} disabled={state === "busy" || !(value > 0) || !quote}>
        {state === "busy" ? "Adding…" : `Add ${fmt(value || 0, 2)} USDC`}
      </button>
      {state === "done" && hash && (
        <Toast kind="ok" title={`${fmt(value, 2)} USDC added`}>
          <TxLink hash={hash} />
        </Toast>
      )}
      {state === "error" && <Toast kind="error" title="Couldn't add money">{msg}</Toast>}
    </div>
  );
}
