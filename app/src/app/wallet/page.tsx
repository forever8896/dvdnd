"use client";

import Link from "next/link";
import { AddMoney } from "@/components/add-money";
import { fmt, TxLink } from "@/components/ui";
import { NETWORK } from "@/lib/config";
import { useAsync } from "@/lib/hooks";
import { horizon } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet";

type Row = { hash: string; at: string; label: string; ops: number; ok: boolean };

async function recentTransactions(account: string): Promise<Row[]> {
  const page = await horizon.transactions().forAccount(account).order("desc").limit(15).call();
  return page.records.map((t) => ({
    hash: t.hash,
    at: t.created_at,
    label: t.memo || (t.operation_count > 1 ? `${t.operation_count} operations` : "Transaction"),
    ops: t.operation_count,
    ok: t.successful,
  }));
}

export default function WalletPage() {
  const { ready, signer, balances, refresh } = useWallet();
  const investor = signer.investor;
  const { data: txs, reload } = useAsync(async () => (investor ? recentTransactions(investor.publicKey) : []), [investor?.publicKey]);

  if (ready && !investor)
    return (
      <main className="page">
        <h1 className="h1">Wallet</h1>
        <div className="empty">
          <div style={{ fontWeight: 800 }}>Sign in to see your wallet</div>
          <Link href="/signin" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
            Sign in
          </Link>
        </div>
      </main>
    );
  if (!investor) return null;
  const b = balances.investor;

  return (
    <main className="page">
      <h1 className="h1">Wallet</h1>
      <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", borderTop: "2px solid var(--line)" }}>
        <div style={{ padding: "16px 16px 16px 0" }}>
          <div className="label">USDC</div>
          <div className="num" style={{ fontSize: 34, marginTop: 6 }}>
            {fmt(b?.usdc ?? 0, 2)}
          </div>
          <div className="small">{b?.usdc === null ? "No USDC trustline yet; adding money creates it" : "Circle USDC on Stellar testnet"}</div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="label">XLM</div>
          <div className="num" style={{ fontSize: 34, marginTop: 6 }}>
            {fmt(b?.xlm ?? 0, 2)}
          </div>
          <div className="small">Test XLM from Friendbot, pays network fees</div>
        </div>
        <div style={{ padding: 16, minWidth: 0 }}>
          <div className="label">Address</div>
          <div className="mono small" style={{ overflowWrap: "anywhere", color: "var(--text)", marginTop: 6 }}>
            {investor.publicKey}
          </div>
          <a className="small" href={`${NETWORK.explorer}/account/${investor.publicKey}`} target="_blank" rel="noreferrer">
            View on stellar.expert ↗
          </a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="h2">Add money</h2>
          <p className="muted">
            In production you&apos;d deposit from your bank through a Stellar anchor (MoneyGram or a regional partner).
            On testnet, swap test XLM for Circle&apos;s testnet USDC on Stellar&apos;s DEX.
          </p>
          <AddMoney
            signer={investor}
            onDone={() => {
              void refresh();
              void reload();
            }}
          />
        </section>
        <section style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <h2 className="h2">Recent activity</h2>
          {!txs ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : txs.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.hash}>
                      <td className="num">{new Date(t.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>
                        <TxLink hash={t.hash} />
                      </td>
                      <td>{t.ok ? <span className="pill pill-green">Confirmed</span> : <span className="pill pill-red">Failed</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No transactions yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}
