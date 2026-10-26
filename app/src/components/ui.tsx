// Shared building blocks from the dvdnd foundations sheet.

import { Check, Lock, ShieldCheck, Shield } from "./icons";
import { countryCode } from "@/lib/chain";
import { NETWORK } from "@/lib/config";

export type RaiseStatus = "Open" | "Funded" | "Refunding" | "Trading";

const STATUS_CLASS: Record<RaiseStatus, string> = {
  Open: "pill-accent",
  Funded: "pill-green",
  Refunding: "pill-red",
  Trading: "pill-neutral",
};

export function StatusPill({ status }: { status: RaiseStatus }) {
  return (
    <span className={`pill ${STATUS_CLASS[status]}`}>
      <i className="pill-dot" />
      {status}
    </span>
  );
}

export function EligibilityPill({ state }: { state: "verified" | "unverified" | "expired" | "ineligible" }) {
  if (state === "verified")
    return (
      <span className="pill pill-green">
        <ShieldCheck size={11} />
        Verified
      </span>
    );
  const look = {
    unverified: ["pill-amber", "Verify to invest"],
    expired: ["pill-amber", "Expired"],
    ineligible: ["pill-red", "Not eligible"],
  }[state];
  return (
    <span className={`pill ${look[0]}`}>
      <Shield size={11} />
      {look[1]}
    </span>
  );
}

export function LockPill({ days }: { days: number }) {
  return (
    <span className="pill pill-amber">
      <Lock size={11} />
      Locked · {days}d
    </span>
  );
}

export function PendingPill({ label = "Pending" }: { label?: string }) {
  return (
    <span className="pill pill-amber">
      <i className="spinner" />
      {label}
    </span>
  );
}

/** Raise progress with a marker at the minimum. */
export function RaiseProgress({
  raised,
  min,
  max,
  status,
  investors,
}: {
  raised: number;
  min: number;
  max: number;
  status: RaiseStatus;
  investors?: number;
}) {
  const pct = Math.min(100, (raised / max) * 100);
  const minPct = (min / max) * 100;
  const fill =
    status === "Funded" ? "var(--green)" : status === "Refunding" ? "var(--faint)" : "var(--accent)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="progress" role="img" aria-label={`${fmt(raised)} of ${fmt(max)} USDC raised`}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: fill }} />
        <div
          className="progress-min"
          style={{ left: `${minPct}%`, background: status === "Refunding" ? "var(--red)" : undefined }}
        />
      </div>
      <div className="progress-legend">
        <span>
          <b>{fmt(raised)}</b> raised{investors !== undefined ? ` · ${investors} investors` : ""}
        </span>
        <span className={status === "Refunding" ? "red" : undefined}>
          min {compact(min)}
          {status === "Refunding" ? " missed" : ""}
        </span>
        <span>max {fmt(max)}</span>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  size = 22,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  size?: number;
  tone?: "green";
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div
        className="num"
        style={{ fontSize: size, lineHeight: 1.2, marginTop: 4, color: tone ? `var(--${tone})` : undefined }}
      >
        {value}
        {unit && (
          <span className="muted" style={{ fontSize: Math.round(size * 0.5) }}>
            {" "}
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

const EXPLORER = `${NETWORK.explorer}/tx/`;

export function TxLink({ hash }: { hash: string }) {
  const short = hash.length > 12 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash;
  return (
    <a className="mono" href={EXPLORER + hash} target="_blank" rel="noreferrer">
      {short} ↗
    </a>
  );
}

export function VerifiedOnStellar({ hash }: { hash: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span
        style={{
          width: 16,
          height: 16,
          background: "var(--text)",
          color: "var(--bg)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          font: "800 9px var(--font-sans)",
        }}
      >
        S
      </span>
      Verified on Stellar <TxLink hash={hash} />
    </span>
  );
}

export function Toast({
  kind,
  title,
  children,
}: {
  kind: "pending" | "ok" | "error";
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="toast" data-kind={kind} role="status">
      {kind === "pending" && <i className="spinner" style={{ color: "var(--amber)", width: 14, height: 14, marginTop: 2 }} />}
      {kind === "ok" && (
        <span style={{ color: "var(--green)", marginTop: 3 }}>
          <Check strokeWidth={3} />
        </span>
      )}
      {kind === "error" && (
        <span
          style={{
            width: 14,
            height: 14,
            background: "var(--red)",
            color: "var(--bg)",
            font: "800 10px/14px var(--font-sans)",
            textAlign: "center",
            flex: "none",
            marginTop: 2,
          }}
        >
          !
        </span>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
        {children && <div className="small">{children}</div>}
      </div>
    </div>
  );
}

/** A date, with the time of day when it's within a day of now (minute-long testnet raises). */
export function when(secs: bigint | number) {
  const d = new Date(Number(secs) * 1000);
  if (Math.abs(d.getTime() - Date.now()) < 86_400_000)
    return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Time until a deadline in its largest whole unit: days, then hours, then minutes. */
export function timeLeft(deadline: bigint | number): { value: string; unit: string; short: string } {
  const secs = Number(deadline) - Date.now() / 1000;
  if (secs <= 0) return { value: "0", unit: "left", short: "—" };
  if (secs >= 86400) { const d = Math.ceil(secs / 86400); return { value: String(d), unit: d === 1 ? "day left" : "days left", short: `${d}d` }; }
  if (secs >= 3600) { const h = Math.ceil(secs / 3600); return { value: String(h), unit: h === 1 ? "hour left" : "hours left", short: `${h}h` }; }
  const m = Math.ceil(secs / 60);
  return { value: String(m), unit: m === 1 ? "minute left" : "minutes left", short: `${m}m` };
}

export function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function compact(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function CountryChip({ n }: { n: number }) {
  return (
    <span className="mono" style={{ fontSize: 10, fontWeight: 500, border: "1px solid var(--line)", padding: "1px 4px" }}>
      {countryCode(n)}
    </span>
  );
}
