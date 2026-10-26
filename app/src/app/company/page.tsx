"use client";

import Link from "next/link";
import { useState } from "react";
import { RaiseProgress, StatusPill, Toast, TxLink, fmt } from "@/components/ui";
import {
  CompanyStatus,
  countryName,
  displayStatus,
  dividendPool,
  errorText,
  fromUnits,
  offering,
  parseProfile,
  pool,
  RaiseState,
  type Company,
} from "@/lib/chain";
import { findMyCompany, myListings } from "@/lib/company";
import { useAsync } from "@/lib/hooks";
import { Onboarding } from "./onboarding";
import { useWallet } from "@/lib/wallet";


export default function CompanyHome() {
  const { ready, signer } = useWallet();
  const me = signer.company;
  const { data: company, loading, reload } = useAsync(async () => (me ? findMyCompany(me.publicKey) : null), [me?.publicKey]);

  if (ready && !me)
    return (
      <main className="page">
        <h1 className="h1">dvdnd for companies</h1>
        <div className="empty">
          <div style={{ fontWeight: 800 }}>Sign in as a company to start</div>
          <div className="muted">Verify your business, commit a share of profit and raise USDC from investors worldwide.</div>
          <Link href="/signin" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
            Sign in
          </Link>
        </div>
      </main>
    );
  if (loading && !company) return <main className="page"><div className="skeleton" style={{ height: 240 }} /></main>;

  if (!company || company.status !== CompanyStatus.Active) return <Onboarding company={company} onChange={reload} />;
  return <Dashboard company={company} />;
}

// ── dashboard ─────────────────────────────────────────────────────────

function Dashboard({ company }: { company: Company }) {
  const { signer, balances, refresh } = useWallet();
  const { data: listings, reload } = useAsync(() => myListings(company.id), [company.id]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const profile = parseProfile(company);
  const listing = listings?.at(-1);

  async function close() {
    if (!listing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await offering.finalize(signer.company!, listing.raise.id);
      setResult(res.hash);
      await reload();
      await refresh();
    } catch (e) {
      setError(errorText(e, "offering"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="label">Company dashboard</div>
          <h1 className="h1" style={{ marginTop: 6 }}>
            {company.name}
          </h1>
          <div className="small" style={{ marginTop: 4 }}>
            {countryName(company.country)} · {profile.sector} · commits {company.payout_bps / 100}% of net profit
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="label">Company balance</div>
          <div className="num" style={{ fontSize: 22 }}>
            {fmt(balances.company?.usdc ?? 0, 2)} <span className="muted" style={{ fontSize: 12 }}>USDC</span>
          </div>
        </div>
      </div>
      <div className="rule" />
      {!listings && <div className="skeleton" style={{ height: 160 }} />}
      {listings && !listing && (
        <div className="empty">
          <div style={{ fontWeight: 800 }}>Ready to raise</div>
          <div className="muted">Your company is verified and the agreement is signed. Set the raise terms to issue your token and open it to investors.</div>
          <Link href="/company/raise" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
            Set up raise
          </Link>
        </div>
      )}
      {listing && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <h2 className="h2">Raise</h2>
              <StatusPill status={displayStatus(listing.raise)} />
            </div>
            <RaiseProgress
              raised={fromUnits(listing.raise.raised)}
              min={fromUnits(listing.raise.min_raise)}
              max={fromUnits(listing.raise.max_raise)}
              status={displayStatus(listing.raise)}
              investors={listing.raise.investors}
            />
            {listing.raise.state === RaiseState.Open && (
              <>
                <p className="small">
                  Closes {new Date(Number(listing.raise.deadline) * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}, or as soon as it&apos;s full.
                </p>
                {(listing.raise.raised === listing.raise.max_raise || Number(listing.raise.deadline) <= Date.now() / 1000) && (
                  <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} onClick={close} disabled={busy}>
                    {busy ? "Closing…" : listing.raise.raised >= listing.raise.min_raise ? "Close raise and receive funds" : "Close raise (refunds investors)"}
                  </button>
                )}
              </>
            )}
            {listing.raise.state === RaiseState.Succeeded && (
              <div className="banner banner-green">
                <div>
                  <div style={{ fontWeight: 800, color: "var(--green)" }}>Funded</div>
                  {fmt(fromUnits(listing.raise.raised), 2)} USDC received in full. You paid a flat {fmt(fromUnits(listing.raise.fee_paid), 2)} USDC listing fee when the raise opened.
                </div>
              </div>
            )}
            {listing.raise.state === RaiseState.Failed && (
              <div className="banner banner-red">
                <div>
                  <div style={{ fontWeight: 800, color: "var(--red)" }}>Refunding</div>
                  The minimum wasn&apos;t reached. Investors claim their USDC back.
                </div>
              </div>
            )}
            {result && (
              <Toast kind="ok" title="Raise closed">
                <TxLink hash={result} />
              </Toast>
            )}
            {error && <Toast kind="error" title="That didn't go through">{error}</Toast>}
            <Link href={`/raise/${listing.raise.id}`} className="small">
              View public listing ↗
            </Link>
          </section>
          {listing.raise.state === RaiseState.Succeeded && <DividendSummary token={listing.raise.token} yearly={dividendPool(listing)} />}
        </div>
      )}
    </main>
  );
}

function DividendSummary({ token, yearly }: { token: string; yearly: number }) {
  const { data: p } = useAsync(() => pool(token), [token]);
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 className="h2">Dividends</h2>
      {!p ? (
        <div className="skeleton" style={{ height: 100 }} />
      ) : (
        <div className="grid-cells" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ padding: 14 }}>
            <div className="label">Paid to date</div>
            <div className="num green" style={{ fontSize: 22 }}>
              {fmt(fromUnits(p.total_distributed), 2)}
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <div className="label">Committed per year</div>
            <div className="num" style={{ fontSize: 22 }}>
              {fmt(yearly, 2)}
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <div className="label">Tokens earning</div>
            <div className="num" style={{ fontSize: 22 }}>
              {fmt(fromUnits(p.active_total))}
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <div className="label">Earning next period</div>
            <div className="num" style={{ fontSize: 22 }}>
              {fmt(fromUnits(p.pending_total))}
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/company/dividend" className="btn btn-green btn-wide">
          Pay dividend
        </Link>
        <Link href="/company/compliance" className="btn btn-secondary btn-wide">
          Compliance
        </Link>
      </div>
    </section>
  );
}
