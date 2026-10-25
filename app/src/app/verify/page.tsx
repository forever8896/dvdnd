"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "@/components/icons";
import { EligibilityPill, Toast, TxLink } from "@/components/ui";
import { COUNTRY_OPTIONS, countryName, gate } from "@/lib/chain";
import { IDOS_ENABLED, IS_TESTNET } from "@/lib/config";
import { connectEthereum, ENCLAVE_CONTAINER, hasEthereumWallet, hasProfile, logIn, shareKycCredential, type EvmWallet } from "@/lib/idos-client";
import type { Signer } from "@/lib/stellar";
import { isEligible, useWallet } from "@/lib/wallet";
import { fetchLeaves, leafFromCommitment, proveResidence, randomSecret, secretCommitment, type Credential } from "@/lib/zk";

type Method = "idos" | "demo";
type Step = "form" | "kyc" | "sharing" | "issuing" | "proving" | "verifying" | "done" | "ineligible";

const STEPS: { key: Step; label: string }[] = [
  { key: "form", label: "Identity check" },
  { key: "issuing", label: "Credential issued" },
  { key: "proving", label: "Private proof" },
  { key: "verifying", label: "Verified on Stellar" },
];
const STEP_INDEX: Record<Step, number> = { form: 0, kyc: 0, sharing: 0, issuing: 1, proving: 2, verifying: 3, done: 4, ineligible: 0 };

const credKey = (pk: string) => `dvdnd.credential.${pk}`;

type IssueResponse = { index: number; hash: string; leaf: string; country: number; expiry: number; basis?: string };

export default function Verify() {
  const router = useRouter();
  const { ready, signer, eligibleUntil, refresh } = useWallet();
  const investor = signer.investor;
  const [method, setMethod] = useState<Method>(IDOS_ENABLED ? "idos" : "demo");
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState(620);
  const [outsideUs, setOutsideUs] = useState(false);
  // The investor's idOS identity is an EVM wallet: the idOS relay only logs in EVM wallets.
  const [evm, setEvm] = useState<EvmWallet | null>(null);
  const [evmHasProfile, setEvmHasProfile] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [kycLink, setKycLink] = useState<string | null>(null);
  // The idOS relay runs in its own window: embedding it needs our origin registered with idOS.
  const kycWindow = useRef<Window | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssueResponse | null>(null);
  const [verifiedTx, setVerifiedTx] = useState<string>();
  const [proofMs, setProofMs] = useState<number | null>(null);

  useEffect(() => {
    if (ready && !investor) router.replace("/signin");
  }, [ready, investor, router]);

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    setKycLink(null);
    setStep("form");
  }, []);

  /** Issues the credential (server builds the leaf from the verified country), then proves and registers. */
  const issueAndProve = useCallback(
    async (investor: Signer, issue: (commitment: bigint) => Promise<Response>) => {
      setStep("issuing");
      // The secret never leaves this browser; the issuer only gets Poseidon(secret).
      const s = randomSecret();
      const res = await issue(await secretCommitment(s));
      const body = await res.json();
      if (body.ineligible) {
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

      setStep("proving");
      const t0 = performance.now();
      const leaves = await fetchLeaves();
      const proof = await proveResidence(cred, investor.publicKey, leaves, Math.floor(Date.now() / 1000));
      setProofMs(performance.now() - t0);

      setStep("verifying");
      const v = await gate.verifyAndRegister(investor, proof);
      setVerifiedTx(v.hash);
      await refresh();
      setStep("done");
    },
    [refresh],
  );

  /** After idOS KYC: log the EVM wallet in to idOS, share the credential with us, then issue. */
  const continueWithIdos = useCallback(async () => {
    if (!investor || !evm) return;
    try {
      setKycLink(null);
      setStep("sharing");
      const step = async <T,>(label: string, fn: () => Promise<T>) => {
        try {
          return await fn();
        } catch (e) {
          throw new Error(`${label}: ${e instanceof Error ? e.message : String(e)}`);
        }
      };
      const user = await step("Signing in to idOS", () => logIn(evm.address));
      await step("Sharing your idOS credential", () => shareKycCredential(user));
      await issueAndProve(investor, (commitment) =>
        fetch("/api/idos/credential", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.user.id, commitment: commitment.toString() }),
        }),
      );
    } catch (e) {
      fail(e);
    }
  }, [investor, evm, issueAndProve, fail]);

  // Carry on when the person closes the idOS window.
  useEffect(() => {
    if (step !== "kyc" || !kycLink) return;
    const t = setInterval(() => {
      if (kycWindow.current?.closed) {
        clearInterval(t);
        void continueWithIdos();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [step, kycLink, continueWithIdos]);

  if (!investor) return null;
  const alreadyEligible = isEligible(eligibleUntil) && step === "form";

  async function connectEvm() {
    setError(null);
    setConnecting(true);
    try {
      const w = await connectEthereum();
      setEvm(w);
      setEvmHasProfile(await hasProfile(w.address));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  async function startIdos() {
    if (!evm) return;
    setError(null);
    // Open the window inside the click so popup blockers allow it; the link comes after.
    const win = window.open("about:blank", "idos-kyc", "popup,width=520,height=860");
    try {
      setStep("kyc");
      const res = await fetch("/api/idos/kyc-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evmAddress: evm.address }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't start the identity check.");
      openKycWindow(body.link, win);
    } catch (e) {
      win?.close();
      fail(e);
    }
  }

  function openKycWindow(link: string, win: Window | null = null) {
    const w = win && !win.closed ? win : window.open("about:blank", "idos-kyc", "popup,width=520,height=860");
    if (!w) {
      setKycLink(link); // blocked: the link below opens it in a tab instead
      return;
    }
    w.location.href = link;
    kycWindow.current = w;
    setKycLink(link);
  }

  async function startDemo(e: React.FormEvent) {
    e.preventDefault();
    if (!investor) return;
    setError(null);
    try {
      await issueAndProve(investor, (commitment) =>
        fetch("/api/kyc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commitment: commitment.toString(), country, fullName }),
        }),
      );
    } catch (err) {
      fail(err);
    }
  }

  const activeIndex = STEP_INDEX[step];
  const working = step === "sharing" || step === "issuing" || step === "proving" || step === "verifying";

  return (
    <main className="page" style={{ maxWidth: 880 }}>
      <div>
        <div className="label">Eligibility</div>
        <h1 className="h1" style={{ marginTop: 6 }}>
          Prove you live outside the United States
        </h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
          dvdnd is open to non-US residents. Your identity is checked once, then your browser builds a zero-knowledge
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
          {IDOS_ENABLED && IS_TESTNET && (
            <div className="seg" role="group" aria-label="Identity check" style={{ alignSelf: "flex-start" }}>
              <button aria-pressed={method === "idos"} onClick={() => setMethod("idos")}>
                idOS identity check
              </button>
              <button aria-pressed={method === "demo"} onClick={() => setMethod("demo")}>
                Testnet demo check
              </button>
            </div>
          )}

          {method === "idos" ? (
            <>
              <p style={{ margin: 0 }}>
                <a href="https://www.idos.network" target="_blank" rel="noreferrer">idOS</a> checks your ID document, a
                liveness selfie and your address once. The result is a credential in your own idOS profile, which you can
                reuse with other apps. You then share it with dvdnd, and we only read your country of residence from it.
              </p>
              <p className="small" style={{ margin: 0 }}>
                Your idOS identity uses an Ethereum wallet such as MetaMask, because idOS&apos;s identity check signs in with
                EVM wallets. It only signs idOS messages and never moves funds. Your proof and investments stay on your
                Stellar wallet ({investor.label}), and the two aren&apos;t linked on-chain.
                {IS_TESTNET && " Testnet uses the idOS playground."}
              </p>
              {!evm ? (
                <>
                  <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} disabled={connecting || !hasEthereumWallet()} onClick={connectEvm}>
                    {connecting ? "Connecting…" : "Connect Ethereum wallet"}
                  </button>
                  {!hasEthereumWallet() && (
                    <div className="small red">
                      No Ethereum wallet found in this browser. Install{" "}
                      <a href="https://metamask.io" target="_blank" rel="noreferrer">MetaMask</a> (or another EVM wallet) and reload.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="small mono" style={{ color: "var(--text)" }}>
                    idOS identity {evm.address.slice(0, 6)}…{evm.address.slice(-4)}
                    {evmHasProfile ? " · idOS profile found" : " · no idOS profile yet"}
                  </div>
                  {evmHasProfile ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn btn-primary btn-wide" onClick={() => void continueWithIdos()}>
                        Share my idOS credential
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={startIdos}>
                        Run the identity check
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} onClick={startIdos}>
                      Start the identity check
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <form onSubmit={startDemo} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="small">Testnet demo: your declared residence is accepted without documents.</div>
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
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
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
            </form>
          )}
          {error && <Toast kind="error" title="Verification stopped">{error}</Toast>}
        </div>
      )}

      {step === "kyc" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
          {kycLink ? (
            <>
              <Toast kind="pending" title="Complete the identity check in the idOS window">
                idOS asks for an ID document, a selfie and your address. When it says you&apos;re done, close the window and
                we&apos;ll continue here.
              </Toast>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-sm" onClick={() => void continueWithIdos()}>
                  I&apos;ve finished
                </button>
                <a className="btn btn-secondary btn-sm" href={kycLink} target="idos-kyc" onClick={(e) => { e.preventDefault(); openKycWindow(kycLink); }}>
                  Reopen the idOS window
                </a>
                <button className="btn btn-secondary btn-sm" onClick={() => { kycWindow.current?.close(); fail(new Error("Identity check cancelled.")); }}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <Toast kind="pending" title="Looking for your idOS profile" />
          )}
        </div>
      )}

      {/* idOS's enclave iframe mounts here when it needs the user (e.g. to unlock their profile). */}
      <div id={ENCLAVE_CONTAINER} />

      {working && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
          {step === "sharing" && (
            <Toast kind="pending" title="Sharing your idOS credential with dvdnd">
              Your Ethereum wallet signs you in to idOS, then idOS re-encrypts a copy of your KYC credential for dvdnd.
            </Toast>
          )}
          {issued && (
            <Toast kind="ok" title={`Credential issued for ${countryName(issued.country)}`}>
              {issued.basis && <>Verified by idOS from your {issued.basis} · </>}Added to the on-chain Merkle tree · <TxLink hash={issued.hash} />
            </Toast>
          )}
          {step === "issuing" && <Toast kind="pending" title={method === "idos" ? "Reading your verified residence and issuing your credential" : "Checking residence and issuing your credential"} />}
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
            {issued && <span>Credential issued · <TxLink hash={issued.hash} /></span>}
            {verifiedTx && <span>Proof verified on-chain · <TxLink hash={verifiedTx} /></span>}
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
            dvdnd offers company tokens only to people living outside the United States or sanctioned countries. No
            credential was issued.
          </p>
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setStep("form")}>
            Back
          </button>
        </div>
      )}
    </main>
  );
}
