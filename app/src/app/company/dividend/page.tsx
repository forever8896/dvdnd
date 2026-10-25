"use client";

import Link from "next/link";
import { useState } from "react";
import { AddMoney } from "@/components/add-money";
import { Toast, TxLink, fmt } from "@/components/ui";
import { errorText, fromUnits, parseProfile, pool, RaiseState, toUnits, vault } from "@/lib/chain";
import { findMyCompany, myListings } from "@/lib/company";
import { useAsync } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";

export default function PayDividend() {
  const { signer, balances, refresh } = useWallet();
  const me = signer.company;
  const { data, reload } = useAsync(async () => {
    if (!me) return null;
    const company = await findMyCompany(me.publicKey);
    if (!company) return null;
    const listing = (await myListings(company.id)).find((l) => l.raise.state === RaiseState.Succeeded);
    return { company, listing, pool: listing ? await pool(listing.raise.token) : null };
  }, [me?.publicKey]);
  const [profit, setProfit] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; hash: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!me)
    return (
      <main className="page">
        <div className="empty">
          <div style={{ fontWeight: 800 }}>Sign in as a company first.</div>
          <Link href="/signin" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Sign in</Link>
        </div>
      </main>
    );
  if (!data) return <main className="page"><div className="skeleton" style={{ height: 240 }} /></main>;
  if (!data.listing || !data.pool)
    return (
      <main className="page">
        <div className="empty">
          <div style={{ fontWeight: 800 }}>No funded raise yet</div>
          <div className="muted">Dividends start after a raise closes successfully and investors lock their tokens.</div>
          <Link href="/company" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>Dashboard</Link>
        </div>
      </main>
    );

  const { company, listing, pool: p } = data;
  const profile = parseProfile(company);
  const periodYears = Number(company.period_secs) / 31_536_000;
  const periodProfit = profit !== null ? Number(profit) : Math.round(profile.netProfit * periodYears * 100) / 100;
  const due = (periodProfit * company.payout_bps) / 10_000;
  const earning = fromUnits(p.active_total);
  const pending = fromUnits(p.pending_total);
  const usdc = balances.company?.usdc ?? 0;
  const needsStart = p.active_total === 0n && p.pending_total > 0n;

  async function run(key: string, title: string, fn: () => Promise<{ hash: string }>) {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      setDone((d) => [...d, { title, hash: res.hash }]);
      await reload();
      await refresh();
    } catch (e) {
      setError(errorText(e, "vault"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 960 }}>
      <div>
        <div className="label">{company.name}</div>
        <h1 className="h1" style={{ marginTop: 6 }}>
          Pay a dividend
        </h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 640 }}>
          You committed {company.payout_bps / 100}% of net profit. The payout is shared pro-rata by tokens that were
          locked for the whole period, and a new period starts when you pay.
        </p>
      </div>

      <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", borderTop: "2px solid var(--line)" }}>
        {[
          ["Tokens earning this period", fmt(earning)],
          ["Locked for next period", fmt(pending)],
          ["Paid to date", `${fmt(fromUnits(p.total_distributed), 2)} USDC`],
          ["Company balance", `${fmt(usdc, 2)} USDC`],
        ].map(([k, v]) => (
          <div key={k} style={{ padding: "14px 14px 14px 0" }}>
            <div className="label">{k}</div>
            <div className="num" style={{ fontSize: 22, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      {needsStart ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
          <h2 className="h2">Start the first dividend period</h2>
          <p className="muted">
            {fmt(pending)} tokens are locked and waiting. Starting the period makes them eligible for the next payout.
            Tokens locked after this start earning from the following period.
          </p>
          <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} disabled={busy !== null} onClick={() => run("start", "First period started", () => vault.startPeriod(me, listing.raise.token))}>
            {busy === "start" ? "Starting…" : "Start dividend period"}
          </button>
        </section>
      ) : earning === 0 ? (
        <div className="empty">
          <div style={{ fontWeight: 800 }}>No tokens are locked yet</div>
          <div className="muted">Once investors lock their tokens, you can start the first period and pay dividends.</div>
        </div>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="field">
              <span>Net profit for this period</span>
              <span className="input-wrap">
                <input id="periodProfit" inputMode="decimal" value={profit ?? String(periodProfit)} onChange={(e) => setProfit(e.target.value)} />
                <span className="input-suffix">USD</span>
              </span>
              <span className="small">From your report for the period. Testnet demo scale.</span>
            </label>
            {usdc < due && <AddMoney signer={me} suggested={Math.ceil(due - usdc + 1)} onDone={refresh} />}
          </div>
          <div style={{ background: "var(--surface)", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["Dividend due", `${fmt(due, 2)} USDC`],
              ["Eligible tokens", fmt(earning)],
              ["Per locked token", `${earning ? fmt(due / earning, 4) : "—"} USDC`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--hair)", paddingBottom: 8 }}>
                <span className="muted">{k}</span>
                <span className="num">{v}</span>
              </div>
            ))}
            <button className="btn btn-green btn-block" disabled={busy !== null || !(due > 0) || usdc < due} onClick={() => run("pay", `${fmt(due, 2)} USDC paid to holders`, () => vault.distribute(me, listing.raise.token, toUnits(due)))}>
              {busy === "pay" ? "Paying…" : `Pay ${fmt(due, 2)} USDC`}
            </button>
          </div>
        </section>
      )}

      {done.map((d, i) => (
        <Toast key={i} kind="ok" title={d.title}>
          <TxLink hash={d.hash} />
        </Toast>
      ))}
      {error && <Toast kind="error" title="That didn't go through">{error}</Toast>}
    </main>
  );
}
