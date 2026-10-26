"use client";

// Company onboarding: find the company in a public registry, check the
// prefilled details, register on Stellar, prove ownership, sign the agreement.

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "@/components/icons";
import { ease, Heading, Rail, Stage } from "@/components/onboard";
import { Toast } from "@/components/ui";
import { CompanyStatus, COUNTRY_OPTIONS, countryName, errorText, parseProfile, type Company, type Profile } from "@/lib/chain";
import { PERIODS } from "@/lib/agreement";
import { agreementText, register, sha256, signAgreement } from "@/lib/company";
import { IS_TESTNET } from "@/lib/config";
import { useAsync } from "@/lib/hooks";
import type { RegistryRecord } from "@/lib/registries";
import { useWallet } from "@/lib/wallet";

const STEPS = ["Find", "Details", "Ownership", "Agreement"];

/** Registries the lookup can search, by ISO numeric country. */
const REGISTRY_COUNTRIES: { code: number; label: string }[] = [
  { code: 0, label: "Everywhere" },
  { code: 250, label: "France" },
  { code: 578, label: "Norway" },
  { code: 246, label: "Finland" },
  { code: 203, label: "Czechia" },
  { code: 208, label: "Denmark" },
  { code: 826, label: "United Kingdom" },
];

export function Onboarding({ company, onChange }: { company: Company | null; onChange: () => Promise<void> }) {
  const [found, setFound] = useState<RegistryRecord | "manual" | null>(null);
  const step = company ? (company.status === CompanyStatus.Pending ? 2 : 3) : found ? 1 : 0;
  return (
    <main className="page onb">
      <Rail labels={STEPS} step={step} />
      <AnimatePresence mode="wait">
        <Stage key={step + (company ? `-${company.id}` : "")}>
          {step === 0 && <FindStep onPick={setFound} />}
          {step === 1 && found && <DetailsStep found={found === "manual" ? null : found} onBack={() => setFound(null)} onDone={onChange} />}
          {step === 2 && company && (
            <>
              <Heading kicker="Step 3 of 4" title="Prove it's yours." lede={`One DNS record shows you control ${company.name}'s website. It takes a couple of minutes.`} />
              <VerifyStep company={company} onDone={onChange} />
            </>
          )}
          {step === 3 && company && (
            <>
              <Heading kicker="Step 4 of 4" title="Commit a share of profit." lede="Choose how much of your yearly net profit goes to token holders, and how often you pay. You sign it once, on Stellar." />
              <AgreementStep company={company} onDone={onChange} />
            </>
          )}
        </Stage>
      </AnimatePresence>
    </main>
  );
}

// ── 1. find the company ───────────────────────────────────────────────

function FindStep({ onPick }: { onPick: (r: RegistryRecord | "manual") => void }) {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState(0);
  const [results, setResults] = useState<RegistryRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const still = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  // Search as they type, a beat after the last key.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/registry?q=${encodeURIComponent(term)}${country ? `&country=${country}` : ""}`, { signal: ctrl.signal });
        setResults(((await res.json()) as { results: RegistryRecord[] }).results);
      } catch {
        /* superseded by a newer search */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, country]);

  return (
    <>
      <Heading kicker="Step 1 of 4" title="Find your company." lede="Search the public business registers. We fill in what they know, so you only check it." />
      <div className="onb-search">
        <input ref={input} id="companySearch" placeholder="Company name" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" spellCheck={false} />
        {loading && <span className="spinner" aria-label="Searching" />}
      </div>
      <div className="onb-chips" role="group" aria-label="Registry">
        {REGISTRY_COUNTRIES.map((c) => (
          <button key={c.code} type="button" aria-pressed={country === c.code} onClick={() => setCountry(c.code)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="onb-results" aria-live="polite">
        <AnimatePresence initial={false}>
          {results?.map((r, i) => (
            <motion.button
              key={r.key}
              type="button"
              className="onb-result"
              disabled={!r.active}
              onClick={() => onPick(r)}
              layout={!still}
              initial={still ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: still ? 0 : i * 0.035, duration: 0.3, ease } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <span className="onb-result-name">{r.name}</span>
              <span className="onb-result-meta">
                <span>{countryName(r.country)}</span>
                {r.city && <span>{r.city}</span>}
                {r.sector && <span>{r.sector}</span>}
                {r.founded && <span>since {r.founded.slice(0, 4)}</span>}
              </span>
              <span className="onb-result-id mono">
                {r.idLabel} {r.id}
              </span>
              {!r.active && <span className="pill pill-red">Closed</span>}
              {r.accounts && r.active && <span className="pill pill-green">Accounts on file</span>}
            </motion.button>
          ))}
        </AnimatePresence>
        {results && !results.length && !loading && <div className="small">No match. Try the legal name, or pick the country.</div>}
      </div>
      <button type="button" className="btn btn-link onb-manual" onClick={() => onPick("manual")}>
        Not listed? Enter the details yourself →
      </button>
      <p className="small onb-sources">
        Searches France&apos;s Registre national des entreprises, Norway&apos;s Brønnøysund registers, Finland&apos;s PRH, Czechia&apos;s ARES,
        Denmark&apos;s CVR and GLEIF&apos;s worldwide LEI index.
      </p>
    </>
  );
}

// ── 2. check the details ──────────────────────────────────────────────

/** A starting description from registry facts, for the company to edit. */
function draftDescription(r: RegistryRecord) {
  const what = r.sector ? r.sector.toLowerCase() : r.activity ? r.activity.toLowerCase() : "business";
  const bits = [`${what.charAt(0).toUpperCase()}${what.slice(1)} ${r.city ? `based in ${r.city}` : `in ${countryName(r.country)}`}`];
  if (r.founded) bits.push(`founded in ${r.founded.slice(0, 4)}`);
  if (r.employees && r.employees !== "0") bits.push(`with ${r.employees} employees`);
  return `${bits.join(", ")}.`;
}

const money = (n: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(n);

function DetailsStep({ found, onBack, onDone }: { found: RegistryRecord | null; onBack: () => void; onDone: () => Promise<void> }) {
  const { signer } = useWallet();
  const still = useReducedMotion();
  const [f, setF] = useState(() => ({
    name: found?.name ?? "",
    country: String(found?.country && found.country !== 840 ? found.country : 233),
    sector: found?.sector ?? "",
    city: found?.city ?? "",
    website: found?.website?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "",
    lei: found?.lei ?? "",
    description: found ? draftDescription(found) : "",
    netProfit: "2000",
  }));
  const [leiState, setLeiState] = useState<"idle" | "looking" | "found" | "none">(found && !found.lei && found.source !== "gleif" ? "looking" : "idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const fromRegistry = useMemo(() => new Set(found ? (["name", "country", found.sector && "sector", found.city && "city", found.website && "website", found.lei && "lei", "description"].filter(Boolean) as string[]) : []), [found]);

  // A national record may have an LEI at GLEIF; look it up quietly.
  useEffect(() => {
    if (leiState !== "looking" || !found) return;
    let live = true;
    fetch(`/api/registry/lei?id=${encodeURIComponent(found.id)}&country=${found.country}`)
      .then((r) => r.json() as Promise<{ lei: string | null }>)
      .then(({ lei }) => {
        if (!live) return;
        if (lei) setF((x) => ({ ...x, lei }));
        setLeiState(lei ? "found" : "none");
      })
      .catch(() => live && setLeiState("none"));
    return () => {
      live = false;
    };
  }, [leiState, found]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile: Profile = {
        sector: f.sector.trim() || "Business",
        city: f.city.trim(),
        description: f.description.trim(),
        website: f.website.trim() ? (f.website.startsWith("http") ? f.website.trim() : `https://${f.website.trim()}`) : undefined,
        lei: f.lei.trim().toUpperCase() || undefined,
        netProfit: Number(f.netProfit) || 0,
        ...(found && found.source !== "gleif" ? { registry: { source: found.source, name: found.registry, id: found.id, idLabel: found.idLabel, url: found.url } } : {}),
        ...(found?.founded ? { founded: found.founded } : {}),
        ...(found?.employees ? { employees: found.employees } : {}),
      };
      await register(signer.company!, f.name.trim(), Number(f.country), profile);
      await onDone();
    } catch (err) {
      setError(errorText(err, "offering"));
      setBusy(false);
    }
  }

  // Fields arrive one after another, like they're being filled in.
  const field = (i: number) => ({
    initial: still ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { delay: still ? 0 : 0.08 + i * 0.06, duration: 0.35, ease } },
  });
  const tag = (k: string) => (fromRegistry.has(k) ? <span className="onb-tag">from registry</span> : null);

  return (
    <>
      <Heading
        kicker="Step 2 of 4"
        title={found ? "Is this you?" : "Tell us about the company."}
        lede={found ? `We filled this in from ${found.registry}. Check it, add your website, and register.` : "Investors see this profile on your raise page. It's stored on Stellar."}
      />
      {found && (
        <motion.div className="onb-card" {...field(0)}>
          <div>
            <div className="onb-card-name">{found.name}</div>
            <div className="small">
              {found.idLabel} <span className="mono">{found.id}</span> ·{" "}
              <a href={found.url} target="_blank" rel="noreferrer">
                view in the register ↗
              </a>
            </div>
          </div>
          <div className="onb-facts">
            {found.founded && <span><b>{found.founded.slice(0, 4)}</b> founded</span>}
            {found.employees && <span><b>{found.employees}</b> employees</span>}
            {found.accounts?.revenue != null && <span><b>{money(found.accounts.revenue, found.accounts.currency)}</b> revenue {found.accounts.year}</span>}
            {found.accounts?.netProfit != null && <span><b>{money(found.accounts.netProfit, found.accounts.currency)}</b> net profit {found.accounts.year}</span>}
          </div>
        </motion.div>
      )}
      <form onSubmit={submit} className="onb-form">
        <motion.label className="field" {...field(1)}>
          <span>Company name {tag("name")}</span>
          <span className="input-wrap"><input id="name" value={f.name} onChange={(e) => set("name")(e.target.value)} /></span>
        </motion.label>
        <motion.label className="field" {...field(2)}>
          <span>Country of incorporation {tag("country")}</span>
          <span className="input-wrap">
            <select id="country" value={f.country} onChange={(e) => set("country")(e.target.value)}>
              {COUNTRY_OPTIONS.filter((c) => c.code !== 840).map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </span>
        </motion.label>
        <motion.label className="field" {...field(3)}>
          <span>Sector {tag("sector")}</span>
          <span className="input-wrap"><input id="sector" value={f.sector} onChange={(e) => set("sector")(e.target.value)} placeholder="e.g. Automotive parts" /></span>
        </motion.label>
        <motion.label className="field" {...field(4)}>
          <span>City {tag("city")}</span>
          <span className="input-wrap"><input id="city" value={f.city} onChange={(e) => set("city")(e.target.value)} /></span>
        </motion.label>
        <motion.label className="field" {...field(5)}>
          <span>Website {tag("website")}</span>
          <span className="input-wrap"><input id="website" value={f.website} onChange={(e) => set("website")(e.target.value)} placeholder="yourcompany.com" /></span>
          <span className="small">You&apos;ll prove you control this domain with one DNS record.</span>
        </motion.label>
        <motion.label className="field" {...field(6)}>
          <span>
            LEI {tag("lei")}
            {leiState === "looking" && <span className="onb-tag onb-tag-muted">checking GLEIF…</span>}
            {leiState === "found" && <span className="onb-tag">found at GLEIF</span>}
          </span>
          <span className="input-wrap"><input id="lei" className="mono" value={f.lei} onChange={(e) => set("lei")(e.target.value)} placeholder="Optional" /></span>
          <span className="small">{leiState === "none" ? "No LEI at GLEIF for this company. That's fine; it's optional." : "With an LEI, we check you against GLEIF."}</span>
        </motion.label>
        <motion.label className="field" {...field(7)}>
          <span>Last year&apos;s net profit (USD)</span>
          <span className="input-wrap"><input id="netProfit" className="mono" value={f.netProfit} onChange={(e) => set("netProfit")(e.target.value)} /></span>
          <span className="small">
            {found?.accounts?.netProfit != null
              ? `Filed: ${money(found.accounts.netProfit, found.accounts.currency)} for ${found.accounts.year}. `
              : ""}
            {IS_TESTNET ? "Testnet demo: use a figure at the scale of your test raise." : "From your latest audited accounts."}
          </span>
        </motion.label>
        <motion.label className="field onb-wide" {...field(8)}>
          <span>About the business {tag("description")}</span>
          <span className="input-wrap"><textarea id="description" value={f.description} onChange={(e) => set("description")(e.target.value)} rows={3} placeholder="What you do, for whom, and since when." /></span>
        </motion.label>
        <motion.div className="onb-actions onb-wide" {...field(9)}>
          <button className="btn btn-primary onb-cta" disabled={busy || !f.name.trim() || !f.website.trim()}>
            {busy ? "Registering on Stellar…" : "Register on Stellar"}
          </button>
          <button type="button" className="btn btn-link" onClick={onBack} disabled={busy}>
            ← Search again
          </button>
          {!busy && (!f.name.trim() || !f.website.trim()) && (
            <span className="small">Add {!f.name.trim() ? "the company name" : "your website"} to continue.</span>
          )}
        </motion.div>
        {error && <Toast kind="error" title="Registration failed">{error}</Toast>}
      </form>
    </>
  );
}

// ── 3–4. ownership and agreement ──────────────────────────────────────

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
  const known = parseProfile(company).registry;
  const [registryNumber, setRegistryNumber] = useState(known?.id ?? "");
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
        ) : known ? (
          <div style={{ background: "var(--surface)", padding: 14, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="label">{known.name}</span>
              <a className="mono small" href={known.url} target="_blank" rel="noreferrer">
                {known.idLabel} {known.id} ↗
              </a>
            </div>
            <div className="small">We check this entry again at the register when you verify: active, same name, same country.</div>
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
        <button className="btn btn-primary btn-wide" style={{ alignSelf: "flex-start" }} disabled={busy || !verified || !director.trim() || (hasLei ? !leiOk : !known && !registryNumber.trim())}>
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
