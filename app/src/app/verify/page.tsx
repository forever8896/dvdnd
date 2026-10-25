"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "@/components/icons";
import { EligibilityPill, Toast, TxLink } from "@/components/ui";
import { countryName, gate } from "@/lib/chain";
import { DIDIT_ENABLED } from "@/lib/config";
import type { Signer } from "@/lib/stellar";
import { isEligible, useWallet } from "@/lib/wallet";
import { fetchLeaves, leafFromCommitment, proveResidence, randomSecret, secretCommitment, type Credential, type SorobanProof } from "@/lib/zk";

type Step = "form" | "kyc" | "issuing" | "proving" | "sign" | "verifying" | "done" | "ineligible";

const STEPS: { key: Step; label: string }[] = [
  { key: "form", label: "Identity check" },
  { key: "issuing", label: "Credential issued" },
  { key: "proving", label: "Private proof" },
  { key: "verifying", label: "Verified on Stellar" },
];
const STEP_INDEX: Record<Step, number> = { form: 0, kyc: 0, issuing: 1, proving: 2, sign: 3, verifying: 3, done: 4, ineligible: 0 };

const credKey = (pk: string) => `dvdnd.credential.${pk}`;

type IssueResponse = { index: number; hash: string; leaf: string; country: number; expiry: number; basis?: string };

export default function Verify() {
  const router = useRouter();
  const { ready, signer, eligibleUntil, refresh } = useWallet();
  const investor = signer.investor;
  const diditReturn = useRef(false);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssueResponse | null>(null);
  const [verifiedTx, setVerifiedTx] = useState<string>();
  const [proofMs, setProofMs] = useState<number | null>(null);
  const [usResident, setUsResident] = useState(false);
  // A built proof waiting for the wallet's signature (external wallets sign on a click).
  const [proof, setProof] = useState<SorobanProof | null>(null);
  // A credential this browser already holds but hasn't registered (e.g. the signature never happened).
  const [stored, setStored] = useState<Credential | null>(null);

  useEffect(() => {
    if (ready && !investor) router.replace("/signin");
  }, [ready, investor, router]);

  useEffect(() => {
    if (!investor) return;
    try {
      const raw = localStorage.getItem(credKey(investor.publicKey));
      setStored(raw ? (JSON.parse(raw) as Credential) : null);
    } catch {
      setStored(null);
    }
  }, [investor]);

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    setStep("form");
  }, []);

  /** Has the gate contract check the proof and register this wallet. */
  const register = useCallback(
    async (investor: Signer, p: SorobanProof) => {
      setStep("verifying");
      const v = await gate.verifyAndRegister(investor, p);
      setVerifiedTx(v.hash);
      setProof(null);
      await refresh();
      setStep("done");
    },
    [refresh],
  );

  /**
   * Builds the proof for a credential. A demo wallet registers straight away;
   * an external wallet waits for a click, because browsers block wallet
   * pop-ups that don't follow one, and proving takes several seconds.
   */
  const proveAndRegister = useCallback(
    async (investor: Signer, cred: Credential) => {
      setStep("proving");
      const t0 = performance.now();
      const leaves = await fetchLeaves();
      const p = await proveResidence(cred, investor.publicKey, leaves, Math.floor(Date.now() / 1000));
      setProofMs(performance.now() - t0);
      if (investor.kind === "external") {
        setProof(p);
        setStep("sign");
        return;
      }
      await register(investor, p);
    },
    [register],
  );

  /** Back from Didit: the server reads the decision and builds the leaf from the verified country. */
  const continueWithDidit = useCallback(
    async (sessionId: string) => {
      if (!investor) return;
      setError(null);
      try {
        setStep("issuing");
        // The secret never leaves this browser; the issuer only gets Poseidon(secret).
        const s = randomSecret();
        const res = await fetch("/api/didit/credential", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, address: investor.publicKey, commitment: (await secretCommitment(s)).toString() }),
        });
        const body = await res.json();
        if (body.ineligible) {
          setUsResident(Boolean(body.us));
          setStep("ineligible");
          return;
        }
        if (!res.ok) throw new Error(body.error ?? "The credential couldn't be issued.");
        const out = body as IssueResponse;
        // The leaf on-chain must be the one our secret opens; check before proving.
        if ((await leafFromCommitment(out.country, out.expiry, await secretCommitment(s))).toString() !== out.leaf) {
          throw new Error("The issued credential doesn't match this browser's secret.");
        }
        const cred: Credential = { country: out.country, expiry: out.expiry, secret: s.toString(), leaf: out.leaf, index: out.index };
        try {
          localStorage.setItem(credKey(investor.publicKey), JSON.stringify(cred));
        } catch {
          /* the credential only lives for this page */
        }
        setIssued(out);
        setStored(cred);
        await proveAndRegister(investor, cred);
      } catch (e) {
        fail(e);
      }
    },
    [investor, proveAndRegister, fail],
  );

  // Didit sends the investor back here with ?provider=didit&verificationSessionId=…
  useEffect(() => {
    if (!investor || diditReturn.current) return;
    const q = new URLSearchParams(window.location.search);
    const sessionId = q.get("verificationSessionId");
    if (q.get("provider") !== "didit" || !sessionId) return;
    diditReturn.current = true;
    router.replace("/verify");
    if (/declined/i.test(q.get("status") ?? "")) {
      fail(new Error("Didit didn't approve the verification. You can try again."));
      return;
    }
    void continueWithDidit(sessionId);
  }, [investor, router, continueWithDidit, fail]);

  if (!investor) return null;
  const alreadyEligible = isEligible(eligibleUntil) && step === "form";
  const now = Date.now() / 1000;
  const resumable = stored && stored.expiry > now && step === "form" && !alreadyEligible;
  const activeIndex = STEP_INDEX[step];
  const working = step === "issuing" || step === "proving" || step === "verifying";

  async function startDidit() {
    if (!investor) return;
    setError(null);
    setStep("kyc");
    try {
      const res = await fetch("/api/didit/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: investor.publicKey }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't start the identity check.");
      window.location.href = body.url;
    } catch (e) {
      fail(e);
    }
  }

  async function signAndRegister() {
    if (!investor || !proof) return;
    setError(null);
    try {
      // The gate accepts proofs made within ~10 minutes of the ledger time; rebuild an old one.
      if (now - proof.now > 480 && stored) {
        await proveAndRegister(investor, stored);
        return;
      }
      await register(investor, proof);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("sign");
    }
  }

  async function resume() {
    if (!investor || !stored) return;
    setError(null);
    try {
      await proveAndRegister(investor, stored);
    } catch (e) {
      fail(e);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 880 }}>
      <div>
        <div className="label">Eligibility</div>
        <h1 className="h1" style={{ marginTop: 6 }}>
          Prove you live outside the United States
        </h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
          Your identity is checked once, then your browser builds a zero-knowledge proof. Stellar verifies the proof
          without learning who you are or where you live.
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
          {resumable ? (
            <>
              <p style={{ margin: 0 }}>
                You already have a verified credential for <b>{countryName(stored!.country)}</b> in this browser. Build the
                proof and register it with {investor.label}.
              </p>
              <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} onClick={resume}>
                Continue
              </button>
            </>
          ) : DIDIT_ENABLED ? (
            <>
              <p style={{ margin: 0 }}>
                A few minutes with your ID document and a live selfie, on your phone or computer. dvdnd only keeps your
                verified country of residence.
              </p>
              <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} onClick={startDidit}>
                Verify my identity
              </button>
              <p className="small" style={{ margin: 0 }}>
                Verification by <a href="https://didit.me" target="_blank" rel="noreferrer">Didit</a>. Living in the US?
                Accredited investors skip this step: open a raise marked 506(c).
              </p>
            </>
          ) : (
            <div className="empty">Identity checks aren&apos;t configured on this deployment.</div>
          )}
          {error && <Toast kind="error" title="Verification stopped">{error}</Toast>}
        </div>
      )}

      {step === "kyc" && <Toast kind="pending" title="Opening the identity check" />}

      {working && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
          {issued && (
            <Toast kind="ok" title={`Credential issued for ${countryName(issued.country)}`}>
              {issued.basis && <>Verified from your {issued.basis} · </>}
              <TxLink hash={issued.hash} />
            </Toast>
          )}
          {step === "issuing" && <Toast kind="pending" title="Reading your verified residence and issuing your credential" />}
          {step === "proving" && (
            <Toast kind="pending" title="Generating your private proof">
              Your browser proves your country isn&apos;t the US, without revealing which country it is.
            </Toast>
          )}
          {step === "verifying" && <Toast kind="pending" title="Verifying on Stellar" />}
        </div>
      )}

      {step === "sign" && proof && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
          <Toast kind="ok" title={`Proof ready${proofMs ? ` in ${(proofMs / 1000).toFixed(1)} s` : ""}`}>
            One signature registers it on Stellar.
          </Toast>
          <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} onClick={signAndRegister}>
            Sign with {investor.label}
          </button>
          {error && <Toast kind="error" title="Registration didn't go through">{error}</Toast>}
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
          {verifiedTx && (
            <div className="small">
              Proof verified on-chain · <TxLink hash={verifiedTx} />
            </div>
          )}
          <Link href="/discover" className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }}>
            Discover raises
          </Link>
        </div>
      )}

      {step === "ineligible" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
          <EligibilityPill state="ineligible" />
          {usResident ? (
            <>
              <h2 className="h2">You can invest as an accredited investor</h2>
              <p className="muted">
                Reg S raises are only for people living outside the US. US residents can join raises marked{" "}
                <b>Reg D 506(c)</b> or <b>Reg S + 506(c)</b> as accredited investors: sign the accreditation statement on the
                raise page, then invest at least 200,000 USDC (1,000,000 for an entity), or less once a verification
                service has confirmed you.
              </p>
              <Link href="/discover" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }}>
                Find raises open to accredited investors
              </Link>
            </>
          ) : (
            <>
              <h2 className="h2">dvdnd isn&apos;t available where you live</h2>
              <p className="muted">
                Residents of sanctioned countries (North Korea, Iran, Cuba and Syria) can&apos;t invest on dvdnd. No
                credential was issued.
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
