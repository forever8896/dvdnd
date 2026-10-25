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
        <h2 className="h2">Testnet wallets</h2>
        {(["investor", "company"] as Role[]).map((role) => {
          const s = signer[role];
          return (
            <div key={role} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--hair)", flexWrap: "wrap" }}>
              <span className="label" style={{ width: 90 }}>
                {role}
              </span>
              <span className="mono small" style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", color: "var(--text)" }}>
                {s ? s.publicKey : "Not created"}
              </span>
              {s && (
                <button className="btn btn-secondary btn-sm" onClick={() => signOut(role)}>
                  Sign out and forget
                </button>
              )}
            </div>
          );
        })}
        <p className="small">Forgetting a wallet removes its key from this browser. Testnet funds in it are lost.</p>
      </section>
    </main>
  );
}
