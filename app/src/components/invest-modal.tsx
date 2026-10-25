"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "./icons";
import { AddMoney } from "./add-money";
import { Modal, ReceiptRow } from "./modal";
import { Toast, TxLink, fmt } from "./ui";
import {
  acceptsAccredited,
  acceptsResidents,
  contribution,
  dividendPool,
  errorText,
  fromUnits,
  isEligibleFor,
  lockedUp,
  offering,
  selfCertification,
  targetYield,
  toUnits,
  type Listing,
} from "@/lib/chain";
import { selfCertifiedMinimum } from "./accreditation";
import { useAsync } from "@/lib/hooks";
import { isEligible, useWallet } from "@/lib/wallet";

type Step = "amount" | "confirm" | "sending" | "done";

export function InvestModal({ listing, onClose, onInvested }: { listing: Listing; onClose: () => void; onInvested: () => void }) {
  const { signer, balances, refresh, eligibleUntil } = useWallet();
  const investor = signer.investor!;
  const available = balances.investor?.usdc ?? 0;
  const room = fromUnits(listing.raise.max_raise - listing.raise.raised);
  const price = fromUnits(listing.raise.price);
  const deadline = new Date(Number(listing.raise.deadline) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState(String(Math.min(100, Math.floor(room))));
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string>();
  const e = listing.raise.terms.exemption;
  // Residents qualify under Reg S where it applies; everyone else through accreditation (506(c)).
  const regD = acceptsAccredited(e) && !(acceptsResidents(e) && isEligible(eligibleUntil));
  // What this investor already has in escrow, and whether a verifier attested them.
  const { data: standing } = useAsync(async () => {
    const [existing, attested, cert, screen] = await Promise.all([
      contribution(listing.raise.id, investor.publicKey),
      regD ? isEligibleFor(listing.raise.id, investor.publicKey, 1n) : Promise.resolve(true),
      regD ? selfCertification(investor.publicKey) : Promise.resolve(null),
      // OFAC wallet screening; if the list can't be checked, don't let the investment through.
      fetch(`/api/screen?address=${investor.publicKey}`).then((r) => r.json()).catch(() => ({ error: "unavailable" })),
    ]);
    const blocked = screen.sanctioned ? "This wallet is on OFAC's sanctions list." : screen.error ? "Sanctions screening is unavailable right now. Try again shortly." : null;
    return { existing: fromUnits(existing), attested, entity: Boolean(cert?.entity), blocked };
  }, [listing.raise.id, investor.publicKey, regD]);

  const value = Number(amount);
  const tokens = value / price;
  const sharePct = room > 0 ? (value / fromUnits(listing.raise.max_raise)) * 100 : 0;
  const yearly = (dividendPool(listing) * sharePct) / 100;
  const tooMuch = value > available;
  const overMax = value > room;
  // The raise's minimum, or 200,000 USDC for a self-certified 506(c) investor; counted on their total.
  const minimum = Math.max(
    fromUnits(listing.raise.terms.min_ticket),
    regD && standing && !standing.attested ? selfCertifiedMinimum(standing.entity) : 0,
  );
  const belowMin = standing ? standing.existing + value < minimum : false;

  async function send() {
    setStep("sending");
    setError(null);
    try {
      const res = await offering.invest(investor, listing.raise.id, toUnits(value));
      setHash(res.hash);
      await refresh();
      onInvested();
      setStep("done");
    } catch (e) {
      setError(errorText(e, "offering"));
      setStep("confirm");
    }
  }

  const name = listing.company.name;

  if (step === "done")
    return (
      <Modal
        title={
          <>
            <span style={{ color: "var(--green)" }}>
              <Check size={18} strokeWidth={3} />
            </span>
            You&apos;re in escrow
          </>
        }
        step="Step 3 of 3"
        onClose={onClose}
      >
        <p>
          If {name} reaches its minimum by {deadline}, you&apos;ll receive {fmt(tokens)} tokens. If not, your{" "}
          {fmt(value, 2)} USDC comes back to you.
        </p>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>
            Escrow receipt
          </div>
          <ReceiptRow label="Amount">{fmt(value, 2)} USDC</ReceiptRow>
          <ReceiptRow label="Date">{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</ReceiptRow>
          <ReceiptRow label="Transaction">{hash && <TxLink hash={hash} />}</ReceiptRow>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/portfolio" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
            View portfolio
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );

  if (step === "confirm" || step === "sending")
    return (
      <Modal title="Confirm investment" step="Step 2 of 3" onClose={step === "sending" ? () => {} : onClose}>
        <div>
          <ReceiptRow label="To escrow for">{name}</ReceiptRow>
          <ReceiptRow label="Amount">{fmt(value, 2)} USDC</ReceiptRow>
          <ReceiptRow label="Tokens on success">{fmt(tokens)}</ReceiptRow>
          <ReceiptRow label="Network fee">under 0.01 XLM</ReceiptRow>
        </div>
        <p className="small">Signed with {investor.label}. Nothing is sent until you confirm.</p>
        {step === "sending" ? (
          <Toast kind="pending" title={`Sending ${fmt(value, 2)} USDC to escrow`}>
            Waiting for Stellar confirmation, about 5 seconds.
          </Toast>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={send}>
              Confirm
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep("amount")}>
              Back
            </button>
          </div>
        )}
        {error && <Toast kind="error" title="Payment failed">{error} Nothing was sent.</Toast>}
      </Modal>
    );

  return (
    <Modal title={`Invest in ${name}`} step="Step 1 of 3" onClose={onClose}>
      <label className="field">
        <span>Amount</span>
        <span className="input-wrap" data-error={tooMuch || overMax}>
          <input id="investAmount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="input-suffix">USDC</span>
        </span>
        <span className="small" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span className={tooMuch ? "red" : undefined}>Available {fmt(available, 2)}</span>
          <span className={overMax ? "red" : undefined}>Room left {fmt(room, 2)}</span>
        </span>
        {minimum > 0 && (
          <span className={`small${belowMin ? " red" : ""}`}>
            Minimum {fmt(minimum)} USDC in total{standing?.existing ? ` (you have ${fmt(standing.existing, 2)} in escrow)` : ""}
            {regD && standing && !standing.attested ? ", the 506(c) minimum without a verifier's attestation." : "."}
          </span>
        )}
      </label>
      <div className="grid-cells" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {[
          ["Tokens received", fmt(tokens || 0)],
          ["Share of profit pool", `${sharePct.toFixed(2)}%`],
          ["Expected dividend / yr", `${fmt(yearly || 0, 2)} USDC`],
          ["At target yield", `${(targetYield(listing) * 100).toFixed(1)}%`],
        ].map(([k, v]) => (
          <div key={k} style={{ padding: 12, background: "var(--surface)" }}>
            <div className="label">{k}</div>
            <div className="num" style={{ fontSize: 18, marginTop: 4 }}>
              {v}
            </div>
          </div>
        ))}
      </div>
      {standing?.blocked && <Toast kind="error" title="Can't invest from this wallet">{standing.blocked}</Toast>}
      {tooMuch && <AddMoney signer={investor} suggested={Math.ceil(value - available + 1)} onDone={refresh} />}
      <p className="small">
        Funds are held in escrow and refunded in full if the minimum isn&apos;t reached by {deadline}. Expected
        dividends are based on last year&apos;s profit and aren&apos;t guaranteed.
        {lockedUp(listing.raise) &&
          ` Your tokens stay in the dividend vault until the lock-up ends on ${new Date(Number(listing.raise.terms.lockup_until) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}: they earn, but can't be sold before then.`}
      </p>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
        <input id="investAgree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          {regD
            ? "I'm an accredited investor, my accreditation statement is still true, and I've read the agreement summary."
            : "I'm currently outside the United States and I've read the agreement summary."}
        </span>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={!agreed || !(value > 0) || tooMuch || overMax || belowMin || !standing || Boolean(standing.blocked)} onClick={() => setStep("confirm")}>
          Continue
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
