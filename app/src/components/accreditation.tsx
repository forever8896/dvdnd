"use client";

// Rule 506(c) eligibility on a raise page: the investor signs the written
// accreditation statement on-chain (its sha256), then either invests at least
// 200,000 USDC (the SEC staff's March 2025 high-minimum route) or gets an
// attestation from the raise's accreditation verifier.

import { useState } from "react";
import { Toast, TxLink, fmt } from "./ui";
import { errorText, fromUnits, isEligibleFor, offering, selfCertification, SELF_CERTIFIED_MINIMUM, type Raise } from "@/lib/chain";
import { IS_TESTNET } from "@/lib/config";
import { sha256 } from "@/lib/company";
import { useAsync } from "@/lib/hooks";
import type { Signer } from "@/lib/stellar";

export const ACCREDITATION_STATEMENT = [
  "dvdnd accreditation statement (Rule 506(c))",
  "1. I am an accredited investor as defined in Rule 501(a) of Regulation D: for example, income over $200,000 (or $300,000 with a spouse or partner) in each of the last two years with the same expected this year; net worth over $1,000,000 excluding my primary residence; or a Series 7, 65 or 82 licence in good standing.",
  "2. My investment is not financed, in whole or in part, by a third party for the specific purpose of making it.",
  "3. I will tell the issuer if either of these stops being true before I invest.",
].join("\n");

export type Accreditation = { attested: boolean; selfCertified: boolean };

/** What this investor can do under a 506(c) raise. */
export function useAccreditation(raise: Raise, investor?: Signer) {
  return useAsync(async (): Promise<Accreditation | null> => {
    if (!investor) return null;
    const [attested, cert] = await Promise.all([
      // Eligible for any amount only through a verifier's attestation.
      isEligibleFor(raise.id, investor.publicKey, 1n),
      selfCertification(investor.publicKey),
    ]);
    return { attested, selfCertified: Boolean(cert) };
  }, [raise.id, investor?.publicKey]);
}

export function AccreditationBox({ raise, investor, state, onChange }: { raise: Raise; investor: Signer; state: Accreditation; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string>();
  const [agreed, setAgreed] = useState(false);
  const minimum = fromUnits(SELF_CERTIFIED_MINIMUM);

  async function sign() {
    setBusy("sign");
    setError(null);
    try {
      const res = await offering.selfCertify(investor, await sha256(ACCREDITATION_STATEMENT));
      setHash(res.hash);
      onChange();
    } catch (e) {
      setError(errorText(e, "offering"));
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setBusy("verify");
    setError(null);
    try {
      const res = await fetch("/api/accredit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investor: investor.publicKey }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The verifier didn't attest.");
      setHash(body.hash);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (state.attested) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--hair)", paddingTop: 12 }}>
      <div className="label">Accredited investors only</div>
      {!state.selfCertified ? (
        <>
          <pre className="small" style={{ whiteSpace: "pre-wrap", margin: 0, font: "12px/1.5 var(--font-sans)", background: "var(--bg)", padding: 10 }}>
            {ACCREDITATION_STATEMENT}
          </pre>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
            <input id="accreditedAgree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
            <span>This is true for me. Record my signed statement on Stellar.</span>
          </label>
          <button className="btn btn-primary btn-block" disabled={!agreed || busy !== null} onClick={sign}>
            {busy === "sign" ? "Signing…" : "Sign accreditation statement"}
          </button>
        </>
      ) : (
        <p className="small" style={{ margin: 0 }}>
          Statement signed. You can invest {fmt(minimum)} USDC or more on your statement alone
          {raise.terms.verifier ? ", or get verified to invest any amount." : "."}
        </p>
      )}
      {state.selfCertified && raise.terms.verifier && IS_TESTNET && (
        <button className="btn btn-secondary btn-block" disabled={busy !== null} onClick={verify}>
          {busy === "verify" ? "Verifying…" : "Get verified (testnet verifier)"}
        </button>
      )}
      {hash && <Toast kind="ok" title="Recorded on Stellar"><TxLink hash={hash} /></Toast>}
      {error && <Toast kind="error" title="That didn't go through">{error}</Toast>}
    </div>
  );
}
