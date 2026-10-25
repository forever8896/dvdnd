"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CountryChip, RaiseProgress, StatusPill, Stat, fmt } from "@/components/ui";
import { EXEMPTION_LABEL,
  countryName,
  displayStatus,
  fromUnits,
  initials,
  listListings,
  targetYield,
  type Listing,
} from "@/lib/chain";
import { IS_TESTNET } from "@/lib/config";
import { useAsync } from "@/lib/hooks";

type Tab = "raises" | "trading";

export default function Discover() {
  const { data, error, loading } = useAsync(listListings);
  const [tab, setTab] = useState<Tab>("raises");

  const { raises, trading } = useMemo(() => {
    const all = data ?? [];
    return {
      raises: all.filter((l) => displayStatus(l.raise) !== "Trading").sort(byDeadline),
      trading: all.filter((l) => displayStatus(l.raise) === "Trading"),
    };
  }, [data]);

  return (
    <main className="page">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div>
          <h1 className="h1">Discover</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Profitable businesses raising against a share of future profit. Fixed price, all-or-nothing.
          </p>
        </div>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={tab === "raises"} onClick={() => setTab("raises")}>
            Raises · {raises.length}
          </button>
          <button aria-pressed={tab === "trading"} onClick={() => setTab("trading")}>
            Trading · {trading.length}
          </button>
        </div>
      </div>

      <div className="rule" />

      {error && <div className="empty">Couldn&apos;t load raises from Stellar: {error}</div>}
      {loading && !data && <Skeletons />}

      {data && tab === "raises" &&
        (raises.length ? (
          <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))" }}>
            {raises.map((l) => (
              <RaiseCard key={l.raise.id} l={l} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="h3" style={{ fontWeight: 800 }}>
              No open raises right now
            </div>
            <div className="muted">Companies can open one from the company side.</div>
            <Link href="/signin" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
              Raise for a company
            </Link>
          </div>
        ))}

      {data && tab === "trading" && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {trading.map((l) => (
            <TradingRow key={l.raise.id} l={l} />
          ))}
          {!trading.length && <div className="empty">No companies trading yet.</div>}
        </div>
      )}

      {IS_TESTNET && (
        <p className="small">
          Testnet demo. Amounts are real testnet USDC; company profits are scaled to the size of the demo raises.
        </p>
      )}
    </main>
  );
}

function byDeadline(a: Listing, b: Listing) {
  return Number(a.raise.deadline - b.raise.deadline);
}

function daysLeft(l: Listing) {
  const s = Number(l.raise.deadline) - Date.now() / 1000;
  if (s <= 0) return "—";
  return s < 86400 ? `${Math.ceil(s / 3600)}h` : String(Math.ceil(s / 86400));
}

function RaiseCard({ l }: { l: Listing }) {
  const status = displayStatus(l.raise);
  return (
    <Link
      href={`/raise/${l.raise.id}`}
      style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, color: "inherit", textDecoration: "none" }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div className="logo-tile">{initials(l.company.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "800 18px/1.2 var(--font-sans)" }}>{l.company.name}</div>
          <div className="small" style={{ marginTop: 3, display: "flex", gap: 8, alignItems: "center" }}>
            <CountryChip n={l.company.country} />
            {countryName(l.company.country)} · {l.profile.sector}
            {l.profile.city && ` · ${l.profile.city}`}
          </div>
          <span className="pill pill-outline" style={{ marginTop: 6 }}>{EXEMPTION_LABEL[l.raise.terms.exemption]}</span>
        </div>
        <StatusPill status={status} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Stat label="Target yield" value={`${(targetYield(l) * 100).toFixed(1)}%`} />
        <Stat label="Profit committed" value={`${l.company.payout_bps / 100}%`} />
        <Stat label="Days left" value={daysLeft(l)} />
      </div>
      <RaiseProgress
        raised={fromUnits(l.raise.raised)}
        min={fromUnits(l.raise.min_raise)}
        max={fromUnits(l.raise.max_raise)}
        status={status}
        investors={l.raise.investors}
      />
    </Link>
  );
}

function TradingRow({ l }: { l: Listing }) {
  return (
    <Link
      href={`/raise/${l.raise.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "48px minmax(160px, 1.6fr) repeat(3, minmax(100px, 1fr)) auto",
        gap: 16,
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid var(--hair)",
        color: "inherit",
        textDecoration: "none",
        overflowX: "auto",
      }}
    >
      <div className="logo-tile">{initials(l.company.name)}</div>
      <div>
        <div style={{ font: "800 16px var(--font-sans)" }}>{l.company.name}</div>
        <div className="small">
          {countryName(l.company.country)} · {l.profile.sector}
        </div>
      </div>
      <Stat label="Raise price" value={fmt(fromUnits(l.raise.price), 2)} unit="USDC" size={18} />
      <Stat label="Target yield" value={`${(targetYield(l) * 100).toFixed(1)}%`} size={18} tone="green" />
      <Stat label="Raised" value={fmt(fromUnits(l.raise.raised))} unit="USDC" size={18} />
      <StatusPill status="Trading" />
    </Link>
  );
}

function Skeletons() {
  return (
    <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))" }}>
      {[0, 1].map((i) => (
        <div key={i} className="skeleton" style={{ height: 220 }} />
      ))}
    </div>
  );
}
