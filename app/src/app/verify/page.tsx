"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck } from "@/components/icons";
import { EligibilityPill, Toast, TxLink } from "@/components/ui";
import { countryName, gate, ISO_COUNTRIES } from "@/lib/chain";
import { isEligible, useWallet } from "@/lib/wallet";
import { credentialLeaf, fetchLeaves, proveResidence, randomSecret, type Credential } from "@/lib/zk";

type Step = "form" | "issuing" | "proving" | "verifying" | "done" | "ineligible";

const STEPS: { key: Step; label: string }[] = [
  { key: "form", label: "Residence check" },
  { key: "issuing", label: "Credential issued" },
  { key: "proving", label: "Private proof" },
  { key: "verifying", label: "Verified on Stellar" },
];

const credKey = (pk: string) => `dvdnd.credential.${pk}`;

export default function Verify() {
  const router = useRouter();
  const { ready, signer, eligibleUntil, refresh } = useWallet();
  const investor = signer.investor;
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState(620);
  const [outsideUs, setOutsideUs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txs, setTxs] = useState<{ issued?: string; verified?: string }>({});
  const [proofMs, setProofMs] = useState<number | null>(null);

  useEffect(() => {
    if (ready && !investor) router.replace("/signin");
  }, [ready, investor, router]);

  if (!investor) return null;
  const alreadyEligible = isEligible(eligibleUntil) && step === "form";

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!investor) return;
    setError(null);
    try {
      // 1. Residence check by the (mock) KYC issuer, who adds our credential leaf on-chain.
      setStep("issuing");
      const secret = randomSecret();
      const expiry = Math.floor(Date.now() / 1000) + 365 * 86400;
      const leaf = await credentialLeaf(country, expiry, secret);
      const res = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaf: leaf.toString(), country, fullName }),
      });
      const body = await res.json();
      if (body.ineligible) {
        setStep("ineligible");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "The residence check failed.");
      const cred: Credential = { country, expiry, secret: secret.toString(), leaf: leaf.toString(), index: body.index };
      try {
        localStorage.setItem(credKey(investor.publicKey), JSON.stringify(cred));
      } catch {
        /* the credential only lives for this page */
      }
      setTxs({ issued: body.hash });

      // 2. Prove non-US residence in this browser, against the on-chain tree.
      setStep("proving");
      const t0 = performance.now();
      const leaves = await fetchLeaves();
      const now = Math.floor(Date.now() / 1000);
      const proof = await proveResidence(cred, investor.publicKey, leaves, now);
      setProofMs(performance.now() - t0);

      // 3. The gate contract checks the proof with the BN254 pairing and registers us.
      setStep("verifying");
      const v = await gate.verifyAndRegister(investor, proof);
      setTxs((t) => ({ ...t, verified: v.hash }));
      await refresh();
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("form");
    }
  }

  const activeIndex = step === "done" ? STEPS.length : STEPS.findIndex((s) => s.key === step);

  return (
    <main className="page" style={{ maxWidth: 880 }}>
      <div>
        <div className="label">Eligibility</div>
        <h1 className="h1" style={{ marginTop: 6 }}>
          Prove you live outside the United States
        </h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
          dvdnd is open to non-US residents. We check your residence once, then your browser builds a zero-knowledge
          proof. Stellar verifies the proof without learning who you are or where you live.
        </p>
      </div>

      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, background: "var(--hair)" }}>
        {STEPS.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={s.key} style={{ background: "var(--bg)", padding: "12px 14px", borderTop: `2px solid ${done ? "var(--green)" : active ? "var(--accent)" : "var(--line)"}` }}>
              <div className="label" style={{ color: done ? "var(--green)" : active ? "var(--accent-text)" : undefined }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{s.label}</div>
            </li>
          );
        })}
      </ol>

      {alreadyEligible && (
        <div className="banner banner-green">
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: "var(--green)" }}>You&apos;re already eligible</div>
            <div>Valid until {new Date(eligibleUntil * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.</div>
          </div>
          <Link href="/discover" className="btn btn-primary btn-sm">
            Discover raises
          </Link>
        </div>
      )}

      {step === "form" && !alreadyEligible && (
        <form onSubmit={start} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
          <div className="small">
            Testnet demo: the residence check is simulated. In production a KYC provider verifies your documents.
          </div>
          <label className="field">
            <span>Full name</span>
            <span className="input-wrap">
              <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ fontFamily: "var(--font-sans)", fontSize: 14 }} required />
            </span>
          </label>
          <label className="field">
            <span>Country of residence</span>
            <span className="input-wrap">
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(Number(e.target.value))}
                style={{ flex: 1, font: "14px var(--font-sans)", background: "transparent", border: 0, padding: "9px 10px", color: "var(--text)" }}
              >
                {Object.entries(ISO_COUNTRIES).map(([code, c]) => (
                  <option key={code} value={code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
            <input id="outsideUs" type="checkbox" checked={outsideUs} onChange={(e) => setOutsideUs(e.target.checked)} style={{ marginTop: 3 }} />
            I&apos;m currently outside the United States.
          </label>
          <button className="btn btn-primary btn-wide" disabled={!outsideUs || !fullName.trim()}>
            Check residence and build proof
          </button>
          {error && <Toast kind="error" title="Verification stopped">{error}</Toast>}
        </form>
      )}

      {(step === "issuing" || step === "proving" || step === "verifying") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
          {txs.issued && (
            <Toast kind="ok" title={`Credential issued for ${countryName(country)}`}>
              Added to the on-chain Merkle tree · <TxLink hash={txs.issued} />
            </Toast>
          )}
          {step === "issuing" && <Toast kind="pending" title="Checking residence and issuing your credential" />}
          {step === "proving" && (
            <Toast kind="pending" title="Generating your private proof">
              Your browser proves your country isn&apos;t the US, without revealing which country it is. About 5–15 seconds.
            </Toast>
          )}
          {step === "verifying" && (
            <>
              <Toast kind="ok" title={`Proof generated${proofMs ? ` in ${(proofMs / 1000).toFixed(1)} s` : ""}`} />
              <Toast kind="pending" title="Verifying on Stellar">
                The gate contract checks the Groth16 proof with Stellar&apos;s BN254 host functions.
              </Toast>
            </>
          )}
        </div>
      )}

      {step === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
          <div className="banner banner-green">
            <span style={{ color: "var(--green)" }}>
              <ShieldCheck size={22} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: "var(--green)" }}>You&apos;re eligible</div>
              <div>Your wallet can now hold dvdnd company tokens for the next 12 months.</div>
            </div>
          </div>
          <div className="small" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {txs.issued && <span>Credential issued · <TxLink hash={txs.issued} /></span>}
            {txs.verified && <span>Proof verified on-chain · <TxLink hash={txs.verified} /></span>}
          </div>
          <Link href="/discover" className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }}>
            Discover raises
          </Link>
        </div>
      )}

      {step === "ineligible" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
          <EligibilityPill state="ineligible" />
          <h2 className="h2">US residents can&apos;t invest on dvdnd</h2>
          <p className="muted">
            dvdnd offers company tokens only to people living outside the United States. No credential was issued and
            nothing was recorded about you.
          </p>
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setStep("form")}>
            Back
          </button>
        </div>
      )}
    </main>
  );
}
