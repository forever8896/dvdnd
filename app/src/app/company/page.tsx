"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck } from "@/components/icons";
import { RaiseProgress, StatusPill, Toast, TxLink, fmt } from "@/components/ui";
import {
  CompanyStatus,
  countryName,
  displayStatus,
  dividendPool,
  errorText,
  fromUnits,
  COUNTRY_OPTIONS,
  offering,
  parseProfile,
  pool,
  RaiseState,
  type Company,
} from "@/lib/chain";
import { agreementText, findMyCompany, myListings, register, sha256, signAgreement } from "@/lib/company";
import { IS_TESTNET } from "@/lib/config";
import { useAsync } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";

const PERIODS = [
  { label: "Annually", secs: 31_536_000 },
  { label: "Semi-annually", secs: 15_768_000 },
  { label: "Quarterly", secs: 7_884_000 },
];

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

// ── onboarding: details → verify ownership → sign agreement ───────────

function Onboarding({ company, onChange }: { company: Company | null; onChange: () => Promise<void> }) {
  const step = !company ? 0 : company.status === CompanyStatus.Pending ? 1 : 2;
  const labels = ["Company details", "Verify ownership", "Profit agreement"];
  return (
    <main className="page" style={{ maxWidth: 880 }}>
      <div>
        <div className="label">Company onboarding</div>
        <h1 className="h1" style={{ marginTop: 6 }}>
          {company ? company.name : "Raise from investors worldwide"}
        </h1>
      </div>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, background: "var(--hair)" }}>
        {labels.map((l, i) => (
          <li key={l} style={{ background: "var(--bg)", padding: "12px 14px", borderTop: `2px solid ${i < step ? "var(--green)" : i === step ? "var(--accent)" : "var(--line)"}` }}>
            <div className="label" style={{ color: i < step ? "var(--green)" : i === step ? "var(--accent-text)" : undefined }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{l}</div>
          </li>
        ))}
      </ol>
      {step === 0 && <DetailsStep onDone={onChange} />}
      {step === 1 && company && <VerifyStep company={company} onDone={onChange} />}
      {step === 2 && company && <AgreementStep company={company} onDone={onChange} />}
    </main>
  );
}

function TextField({ id, label, value, onChange, hint, mono }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; mono?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-wrap">
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} style={mono ? undefined : { fontFamily: "var(--font-sans)", fontSize: 14 }} />
      </span>
      {hint && <span className="small">{hint}</span>}
    </label>
  );
}

function DetailsStep({ onDone }: { onDone: () => Promise<void> }) {
  const { signer } = useWallet();
  const [f, setF] = useState({ name: "", country: "233", sector: "", city: "", website: "", lei: "", description: "", netProfit: "2000" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(signer.company!, f.name.trim(), Number(f.country), {
        sector: f.sector.trim() || "Business",
        city: f.city.trim(),
        description: f.description.trim(),
        website: f.website.trim() ? (f.website.startsWith("http") ? f.website.trim() : `https://${f.website.trim()}`) : undefined,
        lei: f.lei.trim().toUpperCase() || undefined,
        netProfit: Number(f.netProfit) || 0,
      });
      await onDone();
    } catch (err) {
      setError(errorText(err, "offering"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
      <TextField id="name" label="Company name" value={f.name} onChange={set("name")} />
      <label className="field">
        <span>Country of incorporation</span>
        <span className="input-wrap">
          <select id="country" value={f.country} onChange={(e) => set("country")(e.target.value)} style={{ flex: 1, font: "14px var(--font-sans)", background: "transparent", border: 0, padding: "9px 10px", color: "var(--text)" }}>
            {COUNTRY_OPTIONS.filter((c) => c.code !== 840).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      <TextField id="sector" label="Sector" value={f.sector} onChange={set("sector")} />
      <TextField id="city" label="City" value={f.city} onChange={set("city")} />
      <TextField id="website" label="Website" value={f.website} onChange={set("website")} hint="You'll prove you control this domain with a DNS record." />
      <TextField id="lei" label="LEI (optional)" value={f.lei} onChange={set("lei")} mono hint="Legal Entity Identifier. With one, we verify the company against the GLEIF registry." />
      <TextField id="netProfit" label="Last year's net profit (USD)" value={f.netProfit} onChange={set("netProfit")} mono hint={IS_TESTNET ? "Testnet demo: use a figure at the scale of your test raise." : "From your latest audited accounts."} />
      <label className="field" style={{ gridColumn: "1 / -1" }}>
        <span>About the business</span>
        <span className="input-wrap">
          <textarea id="description" value={f.description} onChange={(e) => set("description")(e.target.value)} rows={3} style={{ flex: 1, font: "14px var(--font-sans)", background: "transparent", border: 0, padding: "9px 10px", color: "var(--text)", resize: "vertical" }} />
        </span>
      </label>
      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
        <p className="small">Your profile is stored on Stellar in the dvdnd registry so investors can see it.</p>
        <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} disabled={busy || !f.name.trim() || !f.website.trim()}>
          {busy ? "Registering on Stellar…" : "Register company"}
        </button>
        {error && <Toast kind="error" title="Registration failed">{error}</Toast>}
      </div>
    </form>
  );
}

type LeiStatus = {
  lei: string | null;
  ok?: boolean;
  problems?: string[];
  error?: string;
  record?: { legalName: string; country: string; registeredAs: string | null; entityStatus: string; registrationStatus: string } | null;
};

type DnsStatus = {
  domain: string;
  names: string[];
  value: string;
  check?: { verified: boolean; foundAt?: string; seen: string[] };
  error?: string;
};

function VerifyStep({ company, onDone }: { company: Company; onDone: () => Promise<void> }) {
  const [registryNumber, setRegistryNumber] = useState("");
  const [director, setDirector] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dns, setDns] = useState<DnsStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: initial } = useAsync(() => fetchDns(company.id), [company.id]);
  const status = dns ?? initial;
  const verified = status?.check?.verified === true;
  const { data: leiStatus } = useAsync(async () => (await fetch(`/api/kyb/lei?companyId=${company.id}`, { cache: "no-store" })).json() as Promise<LeiStatus>, [company.id]);
  const hasLei = !!leiStatus?.lei;
  const leiOk = leiStatus?.ok === true;

  async function fetchDns(id: number): Promise<DnsStatus> {
    const res = await fetch(`/api/kyb/dns?companyId=${id}`, { cache: "no-store" });
    return res.json();
  }

  async function check() {
    setChecking(true);
    try {
      setDns(await fetchDns(company.id));
    } finally {
      setChecking(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the value stays selectable */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/kyb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: company.id, registryNumber, director }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Verification failed.");
      if (body.dns) setDns((d) => (d ? { ...d, check: body.dns } : d));
      setBusy(false);
      return;
    }
    await onDone();
  }

  if (status?.error && !status.domain)
    return (
      <div className="empty">
        <div style={{ fontWeight: 800 }}>No website to verify</div>
        <div className="muted">Ownership is proven through your website&apos;s DNS. Register the company again with its website.</div>
      </div>
    );

  return (
    <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="label">1 · Prove you control the domain</div>
        {!status ? (
          <div className="skeleton" style={{ height: 160 }} />
        ) : (
          <>
            <p className="muted" style={{ fontSize: 13 }}>
              Add this TXT record in your DNS provider for <b style={{ color: "var(--text)" }}>{status.domain}</b>. It ties
              the domain to this registration and your wallet.
            </p>
            <div style={{ background: "var(--surface)", padding: 14, display: "grid", gridTemplateColumns: "70px 1fr", rowGap: 8, columnGap: 12, fontSize: 13 }}>
              <span className="label" style={{ paddingTop: 2 }}>Type</span>
              <span className="mono">TXT</span>
              <span className="label" style={{ paddingTop: 2 }}>Name</span>
              <span className="mono" style={{ overflowWrap: "anywhere" }}>
                _dvdnd <span className="muted">(or @ for {status.domain} itself)</span>
              </span>
              <span className="label" style={{ paddingTop: 2 }}>Value</span>
              <span className="mono" style={{ overflowWrap: "anywhere", userSelect: "all" }}>{status.value}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(status.value)}>
                {copied ? "Copied" : "Copy value"}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={check} disabled={checking}>
                {checking ? "Checking DNS…" : "Check DNS"}
              </button>
            </div>
            {verified ? (
              <Toast kind="ok" title={`Record found on ${status.check!.foundAt}`}>
                {status.domain} is under your control.
              </Toast>
            ) : status.error ? (
              <Toast kind="error" title="DNS lookup failed">{status.error}</Toast>
            ) : (
              <Toast kind="pending" title="Waiting for the record">
                New records usually appear within a few minutes, sometimes up to an hour.
                {status.check?.seen.length ? ` Found a different dvdnd record: ${status.check.seen.join("; ")}` : ""}
              </Toast>
            )}
          </>
        )}
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="label">2 · Company registry</div>
        {!leiStatus ? (
          <div className="skeleton" style={{ height: 80 }} />
        ) : hasLei ? (
          <div style={{ background: "var(--surface)", padding: 14, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="label">GLEIF record</span>
              <a className="mono small" href={`https://search.gleif.org/#/record/${leiStatus.lei}`} target="_blank" rel="noreferrer">
                {leiStatus.lei} ↗
              </a>
            </div>
            {leiStatus.record ? (
              <>
                <div style={{ fontWeight: 600 }}>{leiStatus.record.legalName}</div>
                <div className="small">
                  {leiStatus.record.country} · registry no. {leiStatus.record.registeredAs ?? "—"} · {leiStatus.record.entityStatus.toLowerCase()} · LEI{" "}
                  {leiStatus.record.registrationStatus.toLowerCase()}
                </div>
              </>
            ) : null}
            {leiOk ? (
              <span className="pill pill-green" style={{ alignSelf: "flex-start" }}>
                <ShieldCheck size={11} />
                Matches your registration
              </span>
            ) : (
              <span className="red small">{leiStatus.error ?? leiStatus.problems?.join(" ")}</span>
            )}
          </div>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 13 }}>
              No LEI on file, so the registry details are self-declared and recorded as evidence. Register with an LEI to
              have them checked against GLEIF.
            </p>
            <TextField id="registryNumber" label="Registry number" value={registryNumber} onChange={setRegistryNumber} hint="As shown in the company registry" />
          </>
        )}
        <TextField id="director" label="Your name, as listed director" value={director} onChange={setDirector} />
        <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} disabled={busy || !verified || !director.trim() || (hasLei ? !leiOk : !registryNumber.trim())}>
          {busy ? "Verifying…" : "Verify ownership"}
        </button>
        {!verified && <span className="small">Available once the DNS record is found{hasLei && !leiOk ? " and the LEI matches" : ""}.</span>}
        {error && <Toast kind="error" title="Verification failed">{error}</Toast>}
      </section>
    </form>
  );
}

function AgreementStep({ company, onDone }: { company: Company; onDone: () => Promise<void> }) {
  const { signer } = useWallet();
  const [payout, setPayout] = useState(50);
  const [period, setPeriod] = useState(PERIODS[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = agreementText({ name: company.name, payoutPct: payout, periodLabel: period.label });

  async function sign() {
    setBusy(true);
    setError(null);
    try {
      await signAgreement(signer.company!, company.id, await sha256(text), payout * 100, period.secs);
      await onDone();
    } catch (e) {
      setError(errorText(e, "offering"));
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="pill pill-green" style={{ alignSelf: "flex-start" }}>
          <ShieldCheck size={11} />
          Ownership verified
        </span>
        <label className="field">
          <span>Profit committed to token holders · {payout}%</span>
          <input id="payout" type="range" min={20} max={80} step={5} value={payout} onChange={(e) => setPayout(Number(e.target.value))} />
          <span className="small">Min 20%, max 80% of audited yearly net profit</span>
        </label>
        <div className="field">
          <span>Dividend schedule</span>
          <div className="seg" role="group">
            {PERIODS.map((p) => (
              <button type="button" key={p.label} aria-pressed={p.label === period.label} onClick={() => setPeriod(p)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} onClick={sign} disabled={busy}>
          {busy ? "Signing on Stellar…" : "Sign agreement"}
        </button>
        {error && <Toast kind="error" title="Signing failed">{error}</Toast>}
      </div>
      <div style={{ background: "var(--surface)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="label">Agreement, in plain words</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", font: "13px/1.6 var(--font-sans)" }}>{text}</pre>
        <div className="small">Signing records this text&apos;s SHA-256 hash on Stellar, with your wallet as the signer.</div>
      </div>
    </div>
  );
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
                  {fmt(fromUnits(listing.raise.raised - listing.raise.fee_paid), 2)} USDC received after the {fmt(fromUnits(listing.raise.fee_paid), 2)} USDC platform fee.
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
      <Link href="/company/dividend" className="btn btn-green btn-wide" style={{ alignSelf: "flex-start" }}>
        Pay dividend
      </Link>
    </section>
  );
}
