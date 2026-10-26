"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { AddMoney } from "@/components/add-money";
import { Toast, TxLink, fmt } from "@/components/ui";
import { acceptsAccredited, CompanyStatus, Exemption, EXEMPTION_LABEL, fromUnits, listingFee, parseProfile, REG_D_LOCKUP_SECS, toUnits } from "@/lib/chain";
import { IS_TESTNET } from "@/lib/config";
import { assetCode, findMyCompany, issueShareToken, myListings, openRaise } from "@/lib/company";
import { useAsync } from "@/lib/hooks";
import type { TxResult } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet";

const REG_D_LOCKUP_DAYS = REG_D_LOCKUP_SECS / 86400;
const SHORT_LABEL: Record<Exemption, string> = {
  [Exemption.RegS]: "Reg S",
  [Exemption.RegD506c]: "Reg D 506(c)",
  [Exemption.RegSAnd506c]: "Both",
};
const EXEMPTION_HELP: Record<Exemption, string> = {
  [Exemption.RegS]: "Regulation S: only people who prove, with a zero-knowledge proof, that they live outside the US.",
  [Exemption.RegD506c]:
    "Rule 506(c): accredited investors only, US residents included, verified by an accreditation service or self-certified with at least 200,000 USDC (1,000,000 for an entity). You can market it publicly; file Form D within 15 days of the first sale.",
  [Exemption.RegSAnd506c]:
    "Both side by side: non-US residents under Reg S with the residence proof, and accredited investors, US residents included, under 506(c). Takes the one-year Reg D lock-up; file Form D for the 506(c) sales.",
};

export default function RaiseSetup() {
  const router = useRouter();
  const { signer, balances, refresh } = useWallet();
  const me = signer.company;
  const { data } = useAsync(async () => {
    if (!me) return null;
    const company = await findMyCompany(me.publicKey);
    if (!company) return null;
    const [listings, fee, verifier] = await Promise.all([
      myListings(company.id),
      listingFee(),
      IS_TESTNET ? fetch("/api/accredit").then((r) => (r.ok ? r.json() : {})).then((b: { verifier?: string }) => b.verifier ?? null) : null,
    ]);
    return { company, listings, fee: fromUnits(fee), testnetVerifier: verifier };
  }, [me?.publicKey]);

  const [targetYield, setTargetYield] = useState("18");
  const [minPct, setMinPct] = useState("40");
  const [days, setDays] = useState("7");
  const [maxOverride, setMaxOverride] = useState<string | null>(null);
  const [exemption, setExemption] = useState<Exemption>(Exemption.RegS);
  const [lockupDays, setLockupDays] = useState("0");
  // Testnet demos can run a raise and its lock-up in minutes; mainnet uses days.
  const [unit, setUnit] = useState<"days" | "minutes">("days");
  const unitSecs = unit === "minutes" ? 60 : 86400;
  const [maxHolders, setMaxHolders] = useState("500");
  const [minTicket, setMinTicket] = useState("0");
  const [compliance, setCompliance] = useState("");
  const [acceptVerifier, setAcceptVerifier] = useState(true);
  const [log, setLog] = useState<{ step: string; tx?: TxResult }[]>([]);
  const [busy, setBusy] = useState(false);
  // The issued share token, kept so a retry or the wallet approval doesn't issue a second one.
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!me) return <Gate text="Sign in as a company first." href="/signin" cta="Sign in" />;
  if (!data) return <main className="page"><div className="skeleton" style={{ height: 240 }} /></main>;
  const { company, listings, fee, testnetVerifier } = data;
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
  const lockup = Number(lockupDays);
  const minLockup = acceptsAccredited(exemption) ? (REG_D_LOCKUP_DAYS * 86400) / unitSecs : 0;
  const holders = Number(maxHolders);
  const complianceAccount = compliance.trim() || me.publicKey;
  const complianceValid = StrKey.isValidEd25519PublicKey(complianceAccount);
  const usdc = balances.company?.usdc ?? 0;
  const valid =
    max > 0 && min > 0 && min <= max && Number(days) > 0 &&
    lockup >= minLockup && Number.isInteger(holders) && holders >= 1 && holders <= 2000 &&
    Number(minTicket) >= 0 && Number(minTicket) <= max && complianceValid && usdc >= fee;

  async function publish() {
    setBusy(true);
    setError(null);
    const push = (step: string, tx?: TxResult) => setLog((l) => [...l, { step, tx }]);
    try {
      let token = issued;
      if (!token) {
        setLog([]);
        const res = await issueShareToken(assetCode(company.name), push, me!);
        token = res.token;
        setIssued(token);
        try {
          localStorage.setItem(`dvdnd.issuer.${token}`, res.issuerSecret);
        } catch {
          /* the issuer key is only needed for classic admin actions */
        }
        // External wallets approve in a popup, and browsers block popups that don't follow a click.
        if (me!.kind === "external") {
          push(`Share token ready. Approve the raise in ${me!.label}.`);
          setBusy(false);
          return;
        }
      }
      push("Opening the raise");
      const deadline = Math.floor(Date.now() / 1000) + Math.round(Number(days) * unitSecs);
      const res = await openRaise(me!, {
        companyId: company.id,
        token,
        price: toUnits(1),
        min: toUnits(min),
        max: toUnits(max),
        deadline,
        terms: {
          exemption,
          min_ticket: toUnits(Number(minTicket)),
          max_holders: holders,
          lockup_until: BigInt(deadline + Math.round(lockup * unitSecs)),
          compliance: complianceAccount,
          verifier: acceptsAccredited(exemption) && acceptVerifier && testnetVerifier ? testnetVerifier : undefined,
        },
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
          Investors pay 1.00 USDC per token. The raise is all-or-nothing: you receive everything raised if the minimum
          is reached by the deadline. dvdnd charges a flat {fmt(fee, 2)} USDC listing fee when you open the raise, never
          a share of what you raise.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field id="targetYield" label="Target yield for investors" value={targetYield} onChange={(v) => { setTargetYield(v); setMaxOverride(null); }} suffix="%" hint="Sets the raise size: your yearly dividend pool divided by this yield." />
          <Field id="max" label="Maximum raise" value={String(max)} onChange={setMaxOverride} suffix="USDC" hint={`Suggested ${fmt(suggestedMax)} from ${fmt(pool)} USDC/yr of committed profit.`} />
          <Field id="minPct" label="Minimum, as share of maximum" value={minPct} onChange={setMinPct} suffix="%" />
          {IS_TESTNET && (
            <div className="field">
              <span>Durations</span>
              <div className="seg seg-sm" role="group" aria-label="Duration unit" style={{ alignSelf: "flex-start" }}>
                {(["days", "minutes"] as const).map((u) => (
                  <button
                    key={u}
                    aria-pressed={unit === u}
                    onClick={() => {
                      const k = u === "minutes" ? 60 : 86400;
                      setUnit(u);
                      setDays(u === "minutes" ? "10" : "7");
                      setLockupDays(String(acceptsAccredited(exemption) ? (REG_D_LOCKUP_DAYS * 86400) / k : u === "minutes" ? 5 : 0));
                    }}
                  >
                    {u === "days" ? "Days" : "Minutes (testnet demo)"}
                  </button>
                ))}
              </div>
              <span className="small">Minutes let you open, close, pay a dividend and trade within one demo.</span>
            </div>
          )}
          <Field id="days" label="Raise open for" value={days} onChange={setDays} suffix={unit} />

          <div className="field">
            <span>Who can invest</span>
            <div className="seg" role="group" aria-label="Exemption" style={{ alignSelf: "flex-start" }}>
              {[Exemption.RegS, Exemption.RegD506c, Exemption.RegSAnd506c].map((e) => (
                <button
                  key={e}
                  aria-pressed={exemption === e}
                  onClick={() => {
                    setExemption(e);
                    setLockupDays(String(acceptsAccredited(e) ? (REG_D_LOCKUP_DAYS * 86400) / unitSecs : 0));
                  }}
                >
                  {SHORT_LABEL[e]}
                </button>
              ))}
            </div>
            <span className="small">
              {EXEMPTION_HELP[exemption]}
            </span>
          </div>
          <Field id="lockup" label="Lock-up after the deadline" value={lockupDays} onChange={setLockupDays} suffix={unit} hint={acceptsAccredited(exemption) ? `Reg D shares are restricted for at least a year (Rule 144): minimum ${REG_D_LOCKUP_DAYS} days${unit === "minutes" ? `, ${fmt(minLockup)} minutes. For a short demo, use Reg S` : ""}. Tokens earn dividends in the vault meanwhile but can't move.` : "Tokens earn dividends in the vault during lock-up but can't move. No new holders join until it ends."} />
          <Field id="maxHolders" label="Holder cap" value={maxHolders} onChange={setMaxHolders} suffix="holders" hint="Stays under the Exchange Act §12(g) registration trigger (at most 2,000)." />
          <Field id="minTicket" label="Minimum investment" value={minTicket} onChange={setMinTicket} suffix="USDC" />
          <label className="field">
            <span>Compliance account</span>
            <span className="input-wrap" data-error={!complianceValid}>
              <input id="compliance" value={compliance} placeholder={me.publicKey} onChange={(e) => setCompliance(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
            </span>
            <span className="small">Freezes, unfreezes and claws back holdings, each with a recorded reason. Your company by default, or your transfer agent&apos;s Stellar address.</span>
          </label>
          {acceptsAccredited(exemption) && testnetVerifier && (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
              <input id="acceptVerifier" type="checkbox" checked={acceptVerifier} onChange={(e) => setAcceptVerifier(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Accept attestations from dvdnd&apos;s testnet accreditation verifier (a stand-in for a verification service), so verified investors can put in less than 200,000 USDC.</span>
            </label>
          )}
        </div>
        <div style={{ background: "var(--surface)", padding: 20, display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
          <div className="label">Preview</div>
          {[
            ["Dividend pool / yr", `${fmt(pool, 2)} USDC`],
            ["Maximum raise", `${fmt(max)} USDC`],
            ["Minimum raise", `${fmt(min)} USDC`],
            ["Tokens at maximum", fmt(max)],
            ["Yield at 1.00 / token", `${(impliedYield * 100).toFixed(1)}%`],
            ["You receive at maximum", `${fmt(max, 2)} USDC`],
            ["Listing fee, paid now", `${fmt(fee, 2)} USDC`],
            ["Exemption", EXEMPTION_LABEL[exemption]],
            ["Raise closes", `in ${days} ${unit}, or when full`],
            ["Lock-up ends", `${lockup} ${unit} after the deadline`],
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
          {usdc < fee && <AddMoney signer={me} suggested={Math.ceil(fee - usdc + 1)} onDone={refresh} />}
          <button className="btn btn-primary btn-block" onClick={publish} disabled={!valid || busy}>
            {busy ? "Publishing…" : issued ? `Approve in ${me.label} and open raise` : "Issue token and open raise"}
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
