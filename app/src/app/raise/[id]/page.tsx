"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ShieldCheck } from "@/components/icons";
import { AccreditationBox, useAccreditation } from "@/components/accreditation";
import { InvestModal } from "@/components/invest-modal";
import { CountryChip, RaiseProgress, StatusPill, Toast, TxLink, fmt } from "@/components/ui";
import { CONTRACTS, NETWORK } from "@/lib/config";
import {
  contribution,
  countryName,
  displayStatus,
  dividendPool,
  errorText,
  Exemption,
  EXEMPTION_LABEL,
  fromUnits,
  lockedUp,
  getListing,
  initials,
  offering,
  pool,
  RaiseState,
  targetYield,
  type Listing,
} from "@/lib/chain";
import { normalizeDomain } from "@/lib/dns";
import { useAsync } from "@/lib/hooks";
import { isEligible, useWallet } from "@/lib/wallet";

const TABS = ["Overview", "Agreement", "Dividends", "Holders"] as const;
type Tab = (typeof TABS)[number];

export default function RaisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const raiseId = Number(id);
  const { data: l, error, reload } = useAsync(() => getListing(raiseId), [raiseId]);
  const [tab, setTab] = useState<Tab>("Overview");

  if (error) return <main className="page"><div className="empty">Couldn&apos;t load this raise: {error}</div></main>;
  if (!l) return <main className="page"><div className="skeleton" style={{ height: 320 }} /></main>;

  return (
    <main className="page">
      <div className="small">
        <Link href="/discover">Discover</Link> / {l.company.name}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)", gap: 32, alignItems: "start" }} className="raise-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <Header l={l} />
          <KeyNumbers l={l} />
          <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--hair)" }} role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={t === tab}
                onClick={() => setTab(t)}
                style={{
                  font: `${t === tab ? 600 : 400} 14px var(--font-sans)`,
                  background: "none",
                  border: 0,
                  padding: "10px 0",
                  marginBottom: -1,
                  borderBottom: `2px solid ${t === tab ? "var(--accent)" : "transparent"}`,
                  color: t === tab ? "var(--text)" : "var(--muted)",
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Overview" && <Overview l={l} />}
          {tab === "Agreement" && <Agreement l={l} />}
          {tab === "Dividends" && <Dividends l={l} />}
          {tab === "Holders" && <Holders l={l} />}
        </div>
        <RaisePanel l={l} onChange={reload} />
      </div>
    </main>
  );
}

const hex = (b?: Uint8Array) => (b ? Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("") : "");
const period = (secs: bigint) => {
  const d = Number(secs) / 86400;
  if (d >= 360) return "Annual";
  if (d >= 170) return "Semi-annual";
  if (d >= 85) return "Quarterly";
  return `Every ${Math.round(d)} days`;
};
const date = (secs: bigint | number) =>
  new Date(Number(secs) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Header({ l }: { l: Listing }) {
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
      <div className="logo-tile" style={{ width: 64, height: 64, fontSize: 20 }}>
        {initials(l.company.name)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <h1 className="h1">{l.company.name}</h1>
          <StatusPill status={displayStatus(l.raise)} />
        </div>
        <div className="small" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <CountryChip n={l.company.country} />
          {l.profile.city ? `${l.profile.city}, ` : ""}
          {countryName(l.company.country)} · {l.profile.sector}
          {l.profile.website && (
            <a href={l.profile.website} target="_blank" rel="noreferrer">
              {l.profile.website.replace(/^https?:\/\//, "")} ↗
            </a>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {l.company.kyb_hash && (
            <span className="pill pill-green">
              <ShieldCheck size={11} />
              Ownership verified
            </span>
          )}
          {l.company.kyb_hash && l.profile.lei && (
            <a className="pill pill-green" href={`https://search.gleif.org/#/record/${l.profile.lei}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <ShieldCheck size={11} />
              LEI verified · GLEIF ↗
            </a>
          )}
          {l.company.kyb_hash && normalizeDomain(l.profile.website) && (
            <span className="pill pill-green">
              <ShieldCheck size={11} />
              Domain verified · {normalizeDomain(l.profile.website)}
            </span>
          )}
          {l.company.agreement_hash && (
            <span className="pill pill-green">
              <ShieldCheck size={11} />
              Agreement signed
            </span>
          )}
          <span className="pill pill-accent">{EXEMPTION_LABEL[l.raise.terms.exemption]}</span>
          {l.company.agreement_hash && (
            <span className="mono" style={{ fontSize: 12, background: "var(--surface)", padding: "3px 6px" }}>
              sha256 {hex(l.company.agreement_hash).slice(0, 6)}…{hex(l.company.agreement_hash).slice(-4)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KeyNumbers({ l }: { l: Listing }) {
  const cells: [string, string][] = [
    ["Net profit / yr", `$${fmt(l.profile.netProfit)}`],
    ["Committed", `${l.company.payout_bps / 100}%`],
    ["Dividends / yr", `$${fmt(dividendPool(l))}`],
    ["Target yield", `${(targetYield(l) * 100).toFixed(1)}%`],
    ["Price / token", `${fmt(fromUnits(l.raise.price), 2)}`],
    ["Schedule", period(l.company.period_secs)],
  ];
  return (
    <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", borderTop: "2px solid var(--line)" }}>
      {cells.map(([k, v]) => (
        <div key={k} style={{ padding: "14px 12px 14px 0" }}>
          <div className="label">{k}</div>
          <div className="num" style={{ fontSize: 20, marginTop: 4 }}>
            {v}
          </div>
        </div>
      ))}
    </div>
  );
}

function Overview({ l }: { l: Listing }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 680 }}>
      <h2 className="h2">About {l.company.name}</h2>
      <p>{l.profile.description || "The company hasn't added a description yet."}</p>
      <p className="muted">
        The company commits {l.company.payout_bps / 100}% of audited yearly net profit to token holders for as long as
        the business operates. Dividends are paid in USDC to tokens locked for the full period.
      </p>
    </div>
  );
}

function Agreement({ l }: { l: Listing }) {
  const rows: [string, string][] = [
    ["Commitment", `${l.company.payout_bps / 100}% of audited yearly net profit, paid to token holders.`],
    ["Schedule", `${period(l.company.period_secs)}, paid in USDC.`],
    ["Who gets paid", "Only tokens locked for the full period, pro-rata."],
    ["Duration", "For as long as the business operates."],
    ["If sold", "The obligation transfers to the buyer."],
    ["Late payment", "Flagged publicly; the listing shows the delay."],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 32 }}>
      <div>
        <h2 className="h2" style={{ marginBottom: 12 }}>
          Profit-share agreement, in plain words
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 10, columnGap: 16 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <span className="label" style={{ paddingTop: 2 }}>
                {k}
              </span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "var(--surface)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="label">Signed agreement</div>
        <div className="mono small" style={{ overflowWrap: "anywhere", color: "var(--text)" }}>
          sha256
          <br />
          {hex(l.company.agreement_hash)}
        </div>
        <div className="small">The hash of the signed PDF is recorded on Stellar. Anyone can check the document hasn&apos;t changed.</div>
        <a href={`${NETWORK.explorer}/contract/${CONTRACTS.registry}`} target="_blank" rel="noreferrer" className="small">
          View registry on Stellar ↗
        </a>
      </div>
    </div>
  );
}

function Dividends({ l }: { l: Listing }) {
  const { data: p } = useAsync(() => pool(l.raise.token), [l.raise.token]);
  if (!p) return <div className="skeleton" style={{ height: 96 }} />;
  const paid = fromUnits(p.total_distributed);
  const supply = fromUnits(l.raise.state === RaiseState.Succeeded ? l.raise.raised : l.raise.max_raise) / fromUnits(l.raise.price);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div style={{ padding: 16 }}>
          <div className="label">Paid to date</div>
          <div className="num green" style={{ fontSize: 22, marginTop: 4 }}>
            {paid ? `${fmt(paid, 2)} USDC` : "—"}
          </div>
          <div className="small">{p.period > 1 ? `${p.period - 1} payout${p.period > 2 ? "s" : ""}` : "No payouts yet"}</div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="label">Expected per token / yr</div>
          <div className="num" style={{ fontSize: 22, marginTop: 4 }}>
            {supply ? fmt(dividendPool(l) / supply, 3) : "—"} <span className="muted" style={{ fontSize: 12 }}>USDC</span>
          </div>
          <div className="small">at {(targetYield(l) * 100).toFixed(1)}% target yield</div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="label">Tokens earning now</div>
          <div className="num" style={{ fontSize: 22, marginTop: 4 }}>
            {fmt(fromUnits(p.active_total))}
          </div>
          <div className="small">{fmt(fromUnits(p.pending_total))} more start next period</div>
        </div>
      </div>
      {p.last_distribution > 0n && <div className="small">Last payout {date(p.last_distribution)}.</div>}
    </div>
  );
}

function Holders({ l }: { l: Listing }) {
  return (
    <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
      <div style={{ padding: 16 }}>
        <div className="label">Investors</div>
        <div className="num" style={{ fontSize: 22, marginTop: 4 }}>
          {l.raise.investors}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div className="label">Average ticket</div>
        <div className="num" style={{ fontSize: 22, marginTop: 4 }}>
          {l.raise.investors ? fmt(fromUnits(l.raise.raised) / l.raise.investors, 2) : "—"} <span className="muted" style={{ fontSize: 12 }}>USDC</span>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div className="label">Share token</div>
        <a className="mono small" href={`${NETWORK.explorer}/contract/${l.raise.token}`} target="_blank" rel="noreferrer">
          {l.raise.token.slice(0, 4)}…{l.raise.token.slice(-4)} ↗
        </a>
      </div>
    </div>
  );
}

function Terms({ l }: { l: Listing }) {
  const t = l.raise.terms;
  const agent = t.compliance === l.raise.company ? "The company" : `Agent ${t.compliance.slice(0, 4)}…${t.compliance.slice(-4)}`;
  const rows: [string, string][] = [
    ["Offered under", EXEMPTION_LABEL[t.exemption]],
    ["Minimum investment", t.min_ticket > 0n ? `${fmt(fromUnits(t.min_ticket))} USDC` : t.exemption === Exemption.RegD506c ? "200,000 USDC unless verified" : "None"],
    ["Holders", `${l.raise.holders} of ${t.max_holders} max`],
    ["Lock-up until", date(t.lockup_until)],
    ["Compliance", agent],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map(([k, v]) => (
        <div key={k} className="small" style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--hair)", paddingBottom: 6 }}>
          <span>{k}</span>
          <span style={{ color: "var(--text)", textAlign: "right" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function RaisePanel({ l, onChange }: { l: Listing; onChange: () => void }) {
  const { signer, eligibleUntil, refresh } = useWallet();
  const investor = signer.investor;
  const actor = investor ?? signer.company;
  const regD = l.raise.terms.exemption === Exemption.RegD506c;
  const { data: accreditation, reload: reloadAccreditation } = useAccreditation(l.raise, regD ? (investor ?? undefined) : undefined);
  const { data: mine, reload: reloadMine } = useAsync(
    async () => (investor ? contribution(l.raise.id, investor.publicKey) : 0n),
    [l.raise.id, investor?.publicKey],
  );
  const [investing, setInvesting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; hash: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const r = l.raise;
  const status = displayStatus(r);
  const now = Date.now() / 1000;
  const closable = r.state === RaiseState.Open && (Number(r.deadline) <= now || r.raised === r.max_raise);
  const secsLeft = Number(r.deadline) - now;
  const myUsdc = fromUnits(mine ?? 0n);

  async function act(label: string, fn: () => Promise<{ hash: string }>, title: string) {
    setBusy(label);
    setError(null);
    try {
      const res = await fn();
      setResult({ title, hash: res.hash });
      onChange();
      reloadMine();
      void refresh();
    } catch (e) {
      setError(errorText(e, "offering"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside style={{ position: "sticky", top: 80, background: "var(--surface)", padding: 20, display: "flex", flexDirection: "column", gap: 16, borderTop: "2px solid var(--line)" }}>
      <div>
        <div className="num" style={{ fontSize: 30, lineHeight: 1.1 }}>
          {fmt(fromUnits(r.raised))}
        </div>
        <div className="small">of {fmt(fromUnits(r.max_raise))} USDC</div>
      </div>
      <RaiseProgress raised={fromUnits(r.raised)} min={fromUnits(r.min_raise)} max={fromUnits(r.max_raise)} status={status} />
      <div className="grid-cells" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          [String(r.investors), "investors"],
          [secsLeft > 0 ? (secsLeft < 86400 ? `${Math.ceil(secsLeft / 3600)}h` : String(Math.ceil(secsLeft / 86400))) : "0", secsLeft < 86400 && secsLeft > 0 ? "hours left" : "days left"],
          [date(r.deadline).replace(/ \d{4}$/, ""), "deadline"],
        ].map(([v, k]) => (
          <div key={k} style={{ padding: "10px 0", background: "var(--surface)" }}>
            <div className="num" style={{ fontSize: 18 }}>
              {v}
            </div>
            <div className="small">{k}</div>
          </div>
        ))}
      </div>

      <Terms l={l} />
      {regD && accreditation?.attested && (
        <span className="pill pill-green" style={{ alignSelf: "flex-start" }}>
          <ShieldCheck size={11} />
          Verified accredited investor
        </span>
      )}

      {myUsdc > 0 && (
        <div className="pill pill-accent" style={{ alignSelf: "flex-start" }}>
          You have {fmt(myUsdc, 2)} USDC {r.state === RaiseState.Open ? "in escrow" : r.state === RaiseState.Succeeded ? "to claim as tokens" : "to refund"}
        </div>
      )}

      {/* Primary action follows the raise's live state. */}
      {r.state === RaiseState.Open && !closable && (
        <>
          {!investor ? (
            <Link href="/signin" className="btn btn-primary btn-block">
              Sign in to invest
            </Link>
          ) : !regD && !isEligible(eligibleUntil) ? (
            <Link href="/verify" className="btn btn-primary btn-block">
              Verify residence to invest
            </Link>
          ) : regD && !accreditation ? (
            <div className="skeleton" style={{ height: 40 }} />
          ) : regD && !accreditation!.attested && !accreditation!.selfCertified ? (
            <AccreditationBox raise={r} investor={investor} state={accreditation!} onChange={reloadAccreditation} />
          ) : (
            <button className="btn btn-primary btn-block" onClick={() => setInvesting(true)} style={{ justifyContent: "space-between" }}>
              <span>Invest</span>
              <span className="num" style={{ fontSize: 13, fontWeight: 500 }}>
                {fmt(fromUnits(r.price), 2)} USDC / token
              </span>
            </button>
          )}
          {regD && investor && accreditation?.selfCertified && !accreditation.attested && (
            <AccreditationBox raise={r} investor={investor} state={accreditation} onChange={reloadAccreditation} />
          )}
          <p className="small">
            All-or-nothing. Your USDC stays in escrow until the deadline. If the minimum isn&apos;t reached, it&apos;s
            refunded to you.
            {lockedUp(r) && ` Tokens stay in the dividend vault, earning, until the lock-up ends on ${date(r.terms.lockup_until)}.`}
          </p>
        </>
      )}

      {closable && (
        <>
          <p className="small">
            {r.raised >= r.min_raise
              ? "The raise is complete. Anyone can close it: the company is paid and investors can claim their tokens."
              : "The deadline passed without reaching the minimum. Closing it opens refunds for every investor."}
          </p>
          <button
            className="btn btn-primary btn-block"
            disabled={!actor || busy !== null}
            onClick={() => act("close", () => offering.finalize(actor!, r.id), "Raise closed")}
          >
            {busy === "close" ? "Closing…" : actor ? "Close raise" : "Sign in to close"}
          </button>
        </>
      )}

      {r.state === RaiseState.Succeeded && investor && myUsdc > 0 && (
        <button
          className="btn btn-green btn-block"
          disabled={busy !== null}
          onClick={() => act("claim", () => offering.claimTokens(investor, r.id), lockedUp(r) ? "Tokens claimed into the dividend vault" : "Tokens claimed")}
        >
          {busy === "claim" ? "Claiming…" : `Claim ${fmt(myUsdc / fromUnits(r.price))} tokens${lockedUp(r) ? " into the vault" : ""}`}
        </button>
      )}
      {r.state === RaiseState.Succeeded && investor && myUsdc > 0 && lockedUp(r) && (
        <p className="small">
          Lock-up runs until {date(r.terms.lockup_until)}: your tokens go straight into the dividend vault and earn from
          the next period, but can&apos;t be moved or sold until then.
        </p>
      )}

      {r.state === RaiseState.Failed && investor && myUsdc > 0 && (
        <button className="btn btn-primary btn-block" disabled={busy !== null} onClick={() => act("refund", () => offering.refund(investor, r.id), "Refund received")}>
          {busy === "refund" ? "Refunding…" : `Claim refund of ${fmt(myUsdc, 2)} USDC`}
        </button>
      )}

      {r.state === RaiseState.Succeeded && myUsdc === 0 && (
        <p className="small">
          This raise closed with {fmt(fromUnits(r.raised))} USDC raised.{" "}
          {lockedUp(r) ? `Tokens are locked up until ${date(r.terms.lockup_until)}; after that they trade between eligible holders.` : "Tokens trade between eligible holders."}
        </p>
      )}

      {result && (
        <Toast kind="ok" title={result.title}>
          <TxLink hash={result.hash} />
        </Toast>
      )}
      {error && <Toast kind="error" title="That didn't go through">{error}</Toast>}

      <div className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ width: 16, height: 16, background: "var(--text)", color: "var(--bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "800 9px var(--font-sans)" }}>S</span>
        Escrow contract on Stellar
        <a className="mono" href={`${NETWORK.explorer}/contract/${CONTRACTS.offering}`} target="_blank" rel="noreferrer">
          {CONTRACTS.offering.slice(0, 4)}…{CONTRACTS.offering.slice(-4)} ↗
        </a>
      </div>

      {investing && (
        <InvestModal
          listing={l}
          onClose={() => setInvesting(false)}
          onInvested={() => {
            onChange();
            reloadMine();
          }}
        />
      )}
    </aside>
  );
}
