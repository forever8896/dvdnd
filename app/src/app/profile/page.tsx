"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EligibilityPill } from "@/components/ui";
import { countryName } from "@/lib/chain";
import { isEligible, useWallet, type Role } from "@/lib/wallet";
import type { Credential } from "@/lib/zk";

export default function Profile() {
  const router = useRouter();
  const { signer, eligibleUntil, forget } = useWallet();
  const investor = signer.investor;
  const [cred, setCred] = useState<Credential | null>(null);

  useEffect(() => {
    if (!investor) return;
    try {
      const raw = localStorage.getItem(`dvdnd.credential.${investor.publicKey}`);
      setCred(raw ? JSON.parse(raw) : null);
    } catch {
      setCred(null);
    }
  }, [investor]);

  function signOut(role: Role) {
    forget(role);
    router.push("/");
  }

  const until = eligibleUntil ? new Date(eligibleUntil * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <main className="page" style={{ maxWidth: 880 }}>
      <h1 className="h1">Profile</h1>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h2">Eligibility</h2>
        {investor ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <EligibilityPill state={isEligible(eligibleUntil) ? "verified" : "unverified"} />
            {isEligible(eligibleUntil) ? (
              <span className="small">
                {cred ? `Residence ${countryName(cred.country)} · ` : ""}valid to {until}
              </span>
            ) : (
              <Link href="/verify" className="btn btn-primary btn-sm">
                Verify residence
              </Link>
            )}
          </div>
        ) : (
          <Link href="/signin" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }}>
            Sign in
          </Link>
        )}
        <p className="small">
          Your credential and its secret stay in this browser. On Stellar there is only a hash in the credential tree, a
          one-time nullifier, and the fact that this wallet proved non-US residence.
        </p>
      </section>

      <section id="us-persons" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 className="h2">US persons notice</h2>
        <p className="muted" style={{ maxWidth: 680 }}>
          dvdnd tokens are offered only to people living outside the United States, under Regulation S. Residence, not
          nationality, decides this: a US citizen living abroad may invest, a non-US citizen living in the US may not.
          Tokens are profit-share instruments, not deposits; dividends depend on company profit.
        </p>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 className="h2">Wallets</h2>
        {(["investor", "company"] as Role[]).map((role) => (
          <WalletRow key={role} role={role} onSignOut={() => signOut(role)} />
        ))}
      </section>
    </main>
  );
}

function WalletRow({ role, onSignOut }: { role: Role; onSignOut: () => void }) {
  const { signer, exportSecret } = useWallet();
  const s = signer[role];
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the key stays selectable */
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--hair)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span className="label" style={{ width: 90 }}>
          {role}
        </span>
        {s ? (
          <>
            <span className={`pill ${s.kind === "external" ? "pill-green" : "pill-amber"}`}>{s.label}</span>
            <span className="mono small" style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", color: "var(--text)" }}>
              {s.publicKey}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={onSignOut}>
              {s.kind === "external" ? "Disconnect" : "Sign out and forget"}
            </button>
          </>
        ) : (
          <span className="small">Not signed in</span>
        )}
      </div>
      {s?.kind === "demo" && (
        <div style={{ background: "var(--amber-soft)", padding: 12, fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
          <span>
            This demo wallet&apos;s key lives only in this browser. Clearing site data or switching device loses it, along
            with its eligibility and holdings. Back up the secret key to restore it, and never send real funds to it.
          </span>
          {revealed ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mono" style={{ overflowWrap: "anywhere", userSelect: "all", background: "var(--bg)", padding: "4px 6px", flex: 1, minWidth: 0 }}>
                {revealed}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => copy(revealed)}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setRevealed(null)}>
                Hide
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setRevealed(exportSecret(role))}>
              Show secret key for backup
            </button>
          )}
        </div>
      )}
    </div>
  );
}
