"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast, TxLink, fmt } from "@/components/ui";
import { CompanyStatus, parseProfile, toUnits } from "@/lib/chain";
import { assetCode, findMyCompany, issueShareToken, myListings, openRaise } from "@/lib/company";
import { useAsync } from "@/lib/hooks";
import type { TxResult } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet";

const FEE = 0.05;

export default function RaiseSetup() {
  const router = useRouter();
  const { signer } = useWallet();
  const me = signer.company;
  const { data } = useAsync(async () => {
    if (!me) return null;
    const company = await findMyCompany(me.publicKey);
    return company ? { company, listings: await myListings(company.id) } : null;
  }, [me?.publicKey]);

  const [targetYield, setTargetYield] = useState("18");
  const [minPct, setMinPct] = useState("40");
  const [days, setDays] = useState("7");
  const [maxOverride, setMaxOverride] = useState<string | null>(null);
  const [log, setLog] = useState<{ step: string; tx?: TxResult }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me) return <Gate text="Sign in as a company first." href="/signin" cta="Sign in" />;
  if (!data) return <main className="page"><div className="skeleton" style={{ height: 240 }} /></main>;
  const { company, listings } = data;
  if (company.status !== CompanyStatus.Active) return <Gate text="Finish onboarding first: verify ownership and sign the agreement." href="/company" cta="Continue onboarding" />;
  const open = listings.find((l) => l.raise.state === 0);
  if (open) return <Gate text="You already have a raise open." href={`/raise/${open.raise.id}`} cta="View raise" />;

  const profile = parseProfile(company);
  const pool = (profile.netProfit * company.payout_bps) / 10_000;
  const y = Number(targetYield) / 100;
  const suggestedMax = y > 0 ? Math.round(pool / y) : 0;
  const max = maxOverride !== null ? Number(maxOverride) : suggestedMax;
  const min = Math.round((max * Number(minPct)) / 100);
  const impliedYield = max > 0 ? pool / max : 0;
  const valid = max > 0 && min > 0 && min <= max && Number(days) > 0;

  async function publish() {
    setBusy(true);
    setError(null);
    setLog([]);
    const push = (step: string, tx?: TxResult) => setLog((l) => [...l, { step, tx }]);
    try {
      const { token, issuerSecret } = await issueShareToken(assetCode(company.name), push, me!);
      try {
        localStorage.setItem(`dvdnd.issuer.${token}`, issuerSecret);
      } catch {
        /* the issuer key is only needed for classic admin actions */
      }
      push("Opening the raise");
      const res = await openRaise(me!, {
        companyId: company.id,
        token,
        price: toUnits(1),
        min: toUnits(min),
        max: toUnits(max),
        deadline: Math.floor(Date.now() / 1000) + Number(days) * 86400,
      });
      push("Raise open to verified investors", res);
      router.push(`/raise/${res.raiseId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 1080 }}>
      <div>
        <div className="label">{company.name}</div>
        <h1 className="h1" style={{ marginTop: 6 }}>
          Set up your raise
        </h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 640 }}>
          Investors pay 1.00 USDC per token. The raise is all-or-nothing: you receive the funds, minus dvdnd&apos;s 5%
          fee, only if the minimum is reached by the deadline.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field id="targetYield" label="Target yield for investors" value={targetYield} onChange={(v) => { setTargetYield(v); setMaxOverride(null); }} suffix="%" hint="Sets the raise size: your yearly dividend pool divided by this yield." />
          <Field id="max" label="Maximum raise" value={String(max)} onChange={setMaxOverride} suffix="USDC" hint={`Suggested ${fmt(suggestedMax)} from ${fmt(pool)} USDC/yr of committed profit.`} />
          <Field id="minPct" label="Minimum, as share of maximum" value={minPct} onChange={setMinPct} suffix="%" />
          <Field id="days" label="Raise open for" value={days} onChange={setDays} suffix="days" />
        </div>
        <div style={{ background: "var(--surface)", padding: 20, display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
          <div className="label">Preview</div>
          {[
            ["Dividend pool / yr", `${fmt(pool, 2)} USDC`],
            ["Maximum raise", `${fmt(max)} USDC`],
            ["Minimum raise", `${fmt(min)} USDC`],
            ["Tokens at maximum", fmt(max)],
            ["Yield at 1.00 / token", `${(impliedYield * 100).toFixed(1)}%`],
            ["You receive at maximum", `${fmt(max * (1 - FEE), 2)} USDC`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--hair)", paddingBottom: 8 }}>
              <span className="muted">{k}</span>
              <span className="num">{v}</span>
            </div>
          ))}
          <p className="small">
            Publishing issues your share token on Stellar with compliance flags (only verified investors can hold it)
            and hands its admin to the dvdnd escrow contract, so no one can mint more.
          </p>
          <button className="btn btn-primary btn-block" onClick={publish} disabled={!valid || busy}>
            {busy ? "Publishing…" : "Issue token and open raise"}
          </button>
          {log.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {log.map((l, i) => (
                <Toast key={i} kind={l.tx ? "ok" : i === log.length - 1 && busy ? "pending" : "ok"} title={l.step}>
                  {l.tx && <TxLink hash={l.tx.hash} />}
                </Toast>
              ))}
            </div>
          )}
          {error && <Toast kind="error" title="Publishing stopped">{error}</Toast>}
        </div>
      </div>
    </main>
  );
}

function Field({ id, label, value, onChange, suffix, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; suffix: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-wrap">
        <input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
        <span className="input-suffix">{suffix}</span>
      </span>
      {hint && <span className="small">{hint}</span>}
    </label>
  );
}

function Gate({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <main className="page">
      <div className="empty">
        <div style={{ fontWeight: 800 }}>{text}</div>
        <Link href={href} className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
          {cta}
        </Link>
      </div>
    </main>
  );
}
