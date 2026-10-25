"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast } from "@/components/ui";
import { eligibleUntil } from "@/lib/chain";
import { isEligible, useWallet, type Role } from "@/lib/wallet";

const PATHS: { role: Role; title: string; body: string; cta: string }[] = [
  {
    role: "investor",
    title: "I'm an investor",
    body: "Invest in profitable businesses at a fixed price and receive USDC dividends. Requires proof of residence outside the United States.",
    cta: "Continue as investor",
  },
  {
    role: "company",
    title: "I'm raising for my company",
    body: "Verify your business, commit a share of profit, and raise USDC from investors worldwide in an all-or-nothing escrow.",
    cta: "Continue as company",
  },
];

export default function SignIn() {
  const router = useRouter();
  const { create, signer } = useWallet();
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(role: Role) {
    setBusy(role);
    setError(null);
    try {
      const s = await create(role);
      if (role === "company") router.push("/company");
      else router.push(isEligible(await eligibleUntil(s.publicKey)) ? "/discover" : "/verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 960 }}>
      <div>
        <h1 className="h1">Sign in to dvdnd</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          This testnet demo creates a wallet in your browser and funds it with test XLM. Nothing to install, no real
          money.
        </p>
      </div>
      <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {PATHS.map((p) => {
          const existing = signer[p.role];
          return (
            <div key={p.role} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="label">{p.role}</div>
              <h2 className="h2">{p.title}</h2>
              <p className="muted" style={{ flex: 1 }}>
                {p.body}
              </p>
              {existing && (
                <div className="small mono" style={{ overflowWrap: "anywhere" }}>
                  Wallet {existing.publicKey.slice(0, 6)}…{existing.publicKey.slice(-6)}
                </div>
              )}
              <button className="btn btn-primary btn-wide" onClick={() => go(p.role)} disabled={busy !== null}>
                {busy === p.role ? "Creating wallet…" : existing ? `${p.cta} →` : p.cta}
              </button>
            </div>
          );
        })}
      </div>
      {busy && (
        <Toast kind="pending" title="Setting up your testnet wallet">
          Funding it with 10,000 test XLM from Friendbot. Usually takes a few seconds.
        </Toast>
      )}
      {error && <Toast kind="error" title="Couldn't create the wallet">{error}</Toast>}
    </main>
  );
}
