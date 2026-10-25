"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast } from "@/components/ui";
import { eligibleUntil } from "@/lib/chain";
import { isUserCancel, walletError } from "@/lib/kit";
import type { Signer } from "@/lib/stellar";
import { isEligible, useWallet, type Role } from "@/lib/wallet";

const PATHS: { role: Role; title: string; body: string }[] = [
  {
    role: "investor",
    title: "I'm an investor",
    body: "Invest in profitable businesses at a fixed price and receive USDC dividends. Requires proof of residence outside the United States.",
  },
  {
    role: "company",
    title: "I'm raising for my company",
    body: "Verify your business, commit a share of profit, and raise USDC from investors worldwide in an all-or-nothing escrow.",
  },
];

type Busy = { role: Role; how: "connect" | "demo" | "import" } | null;

export default function SignIn() {
  const router = useRouter();
  const { create, connect, importSecret, signer } = useWallet();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<Role | null>(null);
  const [secret, setSecret] = useState("");

  async function go(role: Role, how: NonNullable<Busy>["how"]) {
    setBusy({ role, how });
    setError(null);
    try {
      const s: Signer = how === "connect" ? await connect(role) : how === "import" ? await importSecret(role, secret) : await create(role);
      setSecret("");
      if (role === "company") router.push("/company");
      else router.push(isEligible(await eligibleUntil(s.publicKey)) ? "/discover" : "/verify");
    } catch (e) {
      // Closing the wallet picker or declining in the wallet isn't an error worth showing.
      if (!isUserCancel(e)) setError(walletError(e).message);
      setBusy(null);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 960 }}>
      <div>
        <h1 className="h1">Sign in to dvdnd</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>
          Connect a Stellar wallet such as Freighter, xBull or Lobstr, set to Testnet. Or use a demo wallet created in
          this browser, with nothing to install.
        </p>
      </div>
      <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {PATHS.map((p) => {
          const existing = signer[p.role];
          const mine = busy?.role === p.role;
          return (
            <div key={p.role} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="label">{p.role}</div>
              <h2 className="h2">{p.title}</h2>
              <p className="muted" style={{ flex: 1 }}>
                {p.body}
              </p>
              {existing && (
                <div className="small" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span>{existing.label}</span>
                  <span className="mono">
                    {existing.publicKey.slice(0, 6)}…{existing.publicKey.slice(-6)}
                  </span>
                </div>
              )}
              {existing ? (
                <button className="btn btn-primary btn-block" onClick={() => router.push(p.role === "company" ? "/company" : "/discover")}>
                  Continue →
                </button>
              ) : (
                <>
                  <button className="btn btn-primary btn-block" onClick={() => go(p.role, "connect")} disabled={busy !== null}>
                    {mine && busy?.how === "connect" ? "Waiting for your wallet…" : "Connect a Stellar wallet"}
                  </button>
                  <button className="btn btn-secondary btn-block" onClick={() => go(p.role, "demo")} disabled={busy !== null}>
                    {mine && busy?.how === "demo" ? "Creating demo wallet…" : "Use a testnet demo wallet"}
                  </button>
                  {importing === p.role ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void go(p.role, "import");
                      }}
                      style={{ display: "flex", flexDirection: "column", gap: 8 }}
                    >
                      <label className="field">
                        <span>Demo wallet secret key</span>
                        <span className="input-wrap">
                          <input id={`secret-${p.role}`} type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="S…" />
                        </span>
                      </label>
                      <button className="btn btn-secondary btn-sm" disabled={busy !== null || !secret.trim()}>
                        {mine && busy?.how === "import" ? "Restoring…" : "Restore wallet"}
                      </button>
                    </form>
                  ) : (
                    <button className="btn btn-link btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setImporting(p.role)}>
                      Restore a demo wallet from its secret key
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {busy?.how === "demo" && (
        <Toast kind="pending" title="Setting up your testnet wallet">
          Funding it with 10,000 test XLM from Friendbot. Usually takes a few seconds.
        </Toast>
      )}
      {error && <Toast kind="error" title="Couldn't sign in">{error}</Toast>}
    </main>
  );
}
