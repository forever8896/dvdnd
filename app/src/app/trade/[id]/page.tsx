"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Toast, TxLink, fmt } from "@/components/ui";
import { errorText, getListing, lockedUp, offering, RaiseState } from "@/lib/chain";
import { useAsync } from "@/lib/hooks";
import { cancelOrder, myOffers, orderBook, placeOrder, recentTrades, shareToken, standing } from "@/lib/trade";
import { useWallet } from "@/lib/wallet";

const date = (secs: bigint | number) => new Date(Number(secs) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const raiseId = Number(id);
  const { signer, refresh } = useWallet();
  const investor = signer.investor;
  const { data: market, reload } = useAsync(async () => {
    const listing = await getListing(raiseId);
    const asset = await shareToken(listing.raise.token);
    const [book, trades, me, offers] = await Promise.all([
      orderBook(asset),
      recentTrades(asset),
      investor ? standing(investor.publicKey, asset) : null,
      investor ? myOffers(investor.publicKey, asset) : [],
    ]);
    return { listing, asset, book, trades, me, offers };
  }, [raiseId, investor?.publicKey]);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tokens, setTokens] = useState("10");
  const [price, setPrice] = useState("1.00");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; hash: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!market) return <main className="page"><div className="skeleton" style={{ height: 320 }} /></main>;
  const { listing, asset, book, trades, me, offers } = market;
  const r = listing.raise;

  async function run(key: string, title: string, fn: () => Promise<{ hash: string }>) {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      setDone({ title, hash: res.hash });
      await reload();
      void refresh();
    } catch (e) {
      setError(errorText(e, "offering"));
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <div>
      <div className="small">
        <Link href={`/raise/${r.id}`}>{listing.company.name}</Link> / Trade
      </div>
      <h1 className="h1" style={{ marginTop: 6 }}>
        Trade {asset.code}
      </h1>
      <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>
        Limit orders on Stellar&apos;s order book, {asset.code} against USDC. Only wallets the offering contract has
        authorized can hold {asset.code}, so you trade only with other eligible holders.
      </p>
    </div>
  );

  if (r.state !== RaiseState.Succeeded || lockedUp(r))
    return (
      <main className="page" style={{ maxWidth: 1080 }}>
        {header}
        <div className="empty">
          {r.state !== RaiseState.Succeeded
            ? "Trading starts after the raise closes successfully."
            : `Trading opens when the lock-up ends on ${date(r.terms.lockup_until)}. Until then tokens earn dividends in the vault.`}
        </div>
      </main>
    );

  const t = Number(tokens);
  const p = Number(price);
  const valid = t > 0 && p > 0 && (side === "sell" ? t <= (me?.tokens ?? 0) : t * p <= (me?.usdc ?? 0));
  const levels = (rows: { price: number; tokens: number }[], kind: "ask" | "bid") =>
    rows.length ? (
      rows.slice(0, 8).map((l, i) => (
        <div key={i} className="num small" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: kind === "ask" ? "var(--red)" : "var(--green)" }}>
          <span>{fmt(l.price, 4)}</span>
          <span>{fmt(l.tokens, 2)}</span>
        </div>
      ))
    ) : (
      <div className="small">No {kind === "ask" ? "sell" : "buy"} orders</div>
    );

  return (
    <main className="page" style={{ maxWidth: 1080 }}>
      {header}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!investor ? (
            <Link href="/signin" className="btn btn-primary btn-wide">Sign in to trade</Link>
          ) : me?.status === "none" ? (
            <>
              <p style={{ margin: 0 }}>Your wallet needs to be authorized to hold {asset.code}. Eligible investors can enable it once.</p>
              <button className="btn btn-primary btn-wide" disabled={busy !== null} onClick={() => run("enable", `${asset.code} enabled`, () => offering.authorizeHolder(investor, r.id))}>
                {busy === "enable" ? "Enabling…" : `Enable ${asset.code} trading`}
              </button>
            </>
          ) : me?.status === "frozen" ? (
            <>
              <p style={{ margin: 0 }}>Your {asset.code} wallet is frozen. If it was frozen by the lock-up, release it now.</p>
              <button className="btn btn-primary btn-wide" disabled={busy !== null} onClick={() => run("release", "Lock-up released", () => offering.release(investor, r.id))}>
                {busy === "release" ? "Releasing…" : "Release my tokens"}
              </button>
            </>
          ) : (
            <>
              <div className="seg" role="group" aria-label="Side" style={{ alignSelf: "flex-start" }}>
                <button aria-pressed={side === "buy"} onClick={() => setSide("buy")}>Buy</button>
                <button aria-pressed={side === "sell"} onClick={() => setSide("sell")}>Sell</button>
              </div>
              <label className="field">
                <span>Tokens</span>
                <span className="input-wrap">
                  <input id="tokens" inputMode="decimal" value={tokens} onChange={(e) => setTokens(e.target.value)} />
                  <span className="input-suffix">{asset.code}</span>
                </span>
              </label>
              <label className="field">
                <span>Price per token</span>
                <span className="input-wrap">
                  <input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
                  <span className="input-suffix">USDC</span>
                </span>
                <span className="small">
                  {side === "buy" ? `Costs up to ${fmt(t * p || 0, 2)} USDC · you have ${fmt(me?.usdc ?? 0, 2)}` : `You have ${fmt(me?.tokens ?? 0, 2)} ${asset.code} in your wallet (locked tokens: unlock them in Portfolio first)`}
                </span>
              </label>
              <button className={`btn btn-wide ${side === "buy" ? "btn-primary" : "btn-green"}`} disabled={!valid || busy !== null} onClick={() => run("order", `${side === "buy" ? "Buy" : "Sell"} order placed`, () => placeOrder(investor, asset, side, t, p))}>
                {busy === "order" ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${fmt(t || 0, 2)} ${asset.code} at ${fmt(p || 0, 4)}`}
              </button>
              <p className="small" style={{ margin: 0 }}>Orders that cross the book fill straight away; the rest wait as limit orders you can cancel.</p>
            </>
          )}
          {offers.length > 0 && (
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Your open orders</div>
              {offers.map((o) => (
                <div key={o.id} className="small" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderBottom: "1px solid var(--hair)", padding: "6px 0" }}>
                  <span>
                    {o.side === "buy" ? "Buy" : "Sell"} {fmt(o.tokens, 2)} at {fmt(o.price, 4)}
                  </span>
                  <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => run(`cancel-${o.id}`, "Order cancelled", () => cancelOrder(investor!, asset, o))}>
                    {busy === `cancel-${o.id}` ? "Cancelling…" : "Cancel"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {done && <Toast kind="ok" title={done.title}><TxLink hash={done.hash} /></Toast>}
          {error && <Toast kind="error" title="That didn't go through">{error}</Toast>}
        </section>

        <section style={{ background: "var(--surface)", padding: 16, display: "flex", flexDirection: "column", gap: 10, alignSelf: "start" }}>
          <div className="label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Price (USDC)</span>
            <span>{asset.code}</span>
          </div>
          <div>{levels([...book.asks].reverse(), "ask")}</div>
          <div className="small" style={{ borderTop: "1px solid var(--hair)", borderBottom: "1px solid var(--hair)", padding: "4px 0" }}>
            Raise price {fmt(Number(r.price) / 1e7, 2)}
          </div>
          <div>{levels(book.bids, "bid")}</div>
          <div className="label" style={{ marginTop: 8 }}>Recent trades</div>
          {trades.length ? (
            trades.map((x, i) => (
              <div key={i} className="num small" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{new Date(x.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                <span>{fmt(x.price, 4)}</span>
                <span>{fmt(x.tokens, 2)}</span>
              </div>
            ))
          ) : (
            <div className="small">No trades yet</div>
          )}
        </section>
      </div>
    </main>
  );
}
