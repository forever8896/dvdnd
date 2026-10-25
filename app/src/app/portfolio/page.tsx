"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock } from "@/components/icons";
import { LockModal } from "@/components/lock-modal";
import { StatusPill, Toast, TxLink, fmt } from "@/components/ui";
import { countryName, displayStatus, errorText, fromUnits, initials, lockedUp, offering, RaiseState, targetYield, vault } from "@/lib/chain";
import { useAsync } from "@/lib/hooks";
import { loadPortfolio, type Holding } from "@/lib/portfolio";
import { useWallet } from "@/lib/wallet";

export default function PortfolioPage() {
  const { ready, signer, refresh } = useWallet();
  const investor = signer.investor;
  const { data, error, reload } = useAsync(async () => (investor ? loadPortfolio(investor.publicKey) : null), [investor?.publicKey]);
  const [modal, setModal] = useState<{ h: Holding; mode: "lock" | "unlock" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; hash: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (ready && !investor)
    return (
      <main className="page">
        <h1 className="h1">Portfolio</h1>
        <div className="empty">
          <div style={{ fontWeight: 800 }}>Sign in to see your portfolio</div>
          <Link href="/signin" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
            Sign in
          </Link>
        </div>
      </main>
    );

  async function act(key: string, title: string, fn: () => Promise<{ hash: string }>, contract: "vault" | "offering") {
    setBusy(key);
    setActionError(null);
    try {
      const res = await fn();
      setResult({ title, hash: res.hash });
      await reload();
      void refresh();
    } catch (e) {
      setActionError(errorText(e, contract));
    } finally {
      setBusy(null);
    }
  }

  const t = data?.totals;
  return (
    <main className="page">
      <h1 className="h1">Portfolio</h1>
      {error && <div className="empty">Couldn&apos;t load your portfolio: {error}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 120 }} />}
      {data && t && (
        <>
          <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", borderTop: "2px solid var(--line)" }}>
            <div style={{ padding: "16px 16px 16px 0" }}>
              <div className="label">Total value</div>
              <div className="num" style={{ fontSize: 34, marginTop: 6 }}>
                {fmt(t.tokensValue + t.escrow + t.claimable, 2)}
              </div>
              <div className="small">
                {fmt(t.tokensValue, 2)} in tokens · {fmt(t.escrow, 2)} in escrow · {fmt(t.claimable, 2)} claimable
              </div>
            </div>
            <div style={{ padding: 16 }}>
              <div className="label">Tokens locked</div>
              <div className="num" style={{ fontSize: 34, marginTop: 6 }}>
                {fmt(t.locked)}
              </div>
              <div className="small">Earning dividends from real profit</div>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="label">Claimable now</div>
              <div className="num green" style={{ fontSize: 34 }}>
                {fmt(t.claimable, 2)} <span className="muted" style={{ fontSize: 14 }}>USDC</span>
              </div>
              {data.holdings
                .filter((h) => h.claimable > 0)
                .map((h) => (
                  <button
                    key={h.listing.raise.id}
                    className="btn btn-green btn-sm"
                    disabled={busy !== null}
                    onClick={() => act(`div-${h.listing.raise.id}`, `${fmt(h.claimable, 2)} USDC is in your wallet`, () => vault.claim(investor!, h.listing.raise.token), "vault")}
                  >
                    {busy === `div-${h.listing.raise.id}` ? "Claiming…" : `Claim ${fmt(h.claimable, 2)} from ${h.listing.company.name}`}
                  </button>
                ))}
            </div>
          </div>

          {result && (
            <Toast kind="ok" title={result.title}>
              Confirmed on Stellar · <TxLink hash={result.hash} />
            </Toast>
          )}
          {actionError && <Toast kind="error" title="That didn't go through">{actionError}</Toast>}

          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 className="h2">Holdings</h2>
            {data.holdings.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th className="r">Tokens</th>
                      <th>Lock status</th>
                      <th className="r">Value</th>
                      <th className="r">Target yield</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.holdings.map((h) => {
                      const price = fromUnits(h.listing.raise.price);
                      const total = h.wallet + h.locked + h.pending;
                      return (
                        <tr key={h.listing.raise.id}>
                          <td>
                            <Link href={`/raise/${h.listing.raise.id}`} style={{ display: "flex", gap: 10, alignItems: "center", color: "inherit", textDecoration: "none" }}>
                              <span className="logo-tile" style={{ width: 32, height: 32, fontSize: 11 }}>
                                {initials(h.listing.company.name)}
                              </span>
                              <span>
                                <div style={{ fontWeight: 600 }}>{h.listing.company.name}</div>
                                <div className="small">{countryName(h.listing.company.country)}</div>
                              </span>
                            </Link>
                          </td>
                          <td className="r num">{fmt(total)}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {h.locked > 0 && (
                                <span className="pill pill-amber">
                                  <Lock size={11} />
                                  {fmt(h.locked)} earning
                                </span>
                              )}
                              {h.pending > 0 && <span className="pill pill-accent">{fmt(h.pending)} from next period</span>}
                              {h.wallet > 0 && <span className="pill pill-outline">{fmt(h.wallet)} unlocked</span>}
                              {h.inOrders > 0 && <span className="pill pill-outline">{fmt(h.inOrders)} in sell orders</span>}
                              {lockedUp(h.listing.raise) && (
                                <span className="pill pill-outline">Lock-up until {new Date(Number(h.listing.raise.terms.lockup_until) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                              )}
                            </div>
                          </td>
                          <td className="r num">{fmt(total * price, 2)}</td>
                          <td className="r num green">{(targetYield(h.listing) * 100).toFixed(1)}%</td>
                          <td className="r" style={{ whiteSpace: "nowrap" }}>
                            {!lockedUp(h.listing.raise) && !h.frozen && (
                              <Link href={`/trade/${h.listing.raise.id}`} className="btn btn-secondary btn-sm">
                                Trade
                              </Link>
                            )}{" "}
                            {h.frozen && !lockedUp(h.listing.raise) && (
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={busy !== null}
                                onClick={() => act(`release-${h.listing.raise.id}`, "Lock-up released", () => offering.release(investor!, h.listing.raise.id), "offering")}
                              >
                                {busy === `release-${h.listing.raise.id}` ? "Releasing…" : "Release lock-up"}
                              </button>
                            )}
                            {h.wallet - h.inOrders > 0 && !h.frozen && (
                              <button className="btn btn-primary btn-sm" onClick={() => setModal({ h, mode: "lock" })}>
                                Lock {fmt(h.wallet - h.inOrders)}
                              </button>
                            )}{" "}
                            {h.locked + h.pending > 0 && !h.frozen && (
                              <button className="btn btn-secondary btn-sm" onClick={() => setModal({ h, mode: "unlock" })}>
                                Unlock
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <div style={{ fontWeight: 800 }}>No holdings yet</div>
                <div className="muted">When a raise you&apos;ve invested in closes, claim your tokens and they appear here.</div>
                <Link href="/discover" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                  Discover raises
                </Link>
              </div>
            )}
          </section>

          {data.escrow.length > 0 && (
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 className="h2">In escrow</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Raise</th>
                      <th className="r">Amount</th>
                      <th>Status</th>
                      <th>Deadline</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.escrow.map(({ listing: l, amount }) => {
                      const st = displayStatus(l.raise);
                      const tokens = amount / fromUnits(l.raise.price);
                      return (
                        <tr key={l.raise.id}>
                          <td>
                            <Link href={`/raise/${l.raise.id}`} style={{ color: "inherit" }}>
                              <div style={{ fontWeight: 600 }}>{l.company.name}</div>
                            </Link>
                            <div className="small">{fmt(tokens)} tokens on success</div>
                          </td>
                          <td className="r num">{fmt(amount, 2)}</td>
                          <td>
                            <StatusPill status={st === "Trading" ? "Funded" : st} />
                          </td>
                          <td className="num">
                            {new Date(Number(l.raise.deadline) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </td>
                          <td className="r" style={{ whiteSpace: "nowrap" }}>
                            {l.raise.state === RaiseState.Succeeded && (
                              <button
                                className="btn btn-green btn-sm"
                                disabled={busy !== null}
                                onClick={() => act(`claim-${l.raise.id}`, `${fmt(tokens)} ${l.company.name} tokens claimed`, () => offering.claimTokens(investor!, l.raise.id), "offering")}
                              >
                                {busy === `claim-${l.raise.id}` ? "Claiming…" : `Claim ${fmt(tokens)} tokens${lockedUp(l.raise) ? " into the vault" : ""}`}
                              </button>
                            )}
                            {l.raise.state === RaiseState.Failed && (
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={busy !== null}
                                onClick={() => act(`refund-${l.raise.id}`, `${fmt(amount, 2)} USDC refunded`, () => offering.refund(investor!, l.raise.id), "offering")}
                              >
                                {busy === `refund-${l.raise.id}` ? "Refunding…" : "Claim refund"}
                              </button>
                            )}
                            {l.raise.state === RaiseState.Open && (
                              <Link href={`/raise/${l.raise.id}`} className="btn btn-secondary btn-sm">
                                View raise
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      {modal && (
        <LockModal
          holding={modal.h}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onDone={() => {
            void reload();
            void refresh();
          }}
        />
      )}
    </main>
  );
}
