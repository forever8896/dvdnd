"use client";

import Link from "next/link";
import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { Toast, TxLink, fmt, when as at } from "@/components/ui";
import { errorText, EXEMPTION_LABEL, lockedUp, offering, toUnits, type Listing } from "@/lib/chain";
import { findMyCompany, myListings } from "@/lib/company";
import { auditLog, holders, type Holder } from "@/lib/compliance";
import { NETWORK } from "@/lib/config";
import { useAsync } from "@/lib/hooks";
import type { Signer } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ACTION_LABEL = { freeze: "Frozen", unfreeze: "Unfrozen", clawback: "Clawed back", handover: "Role handed to" } as const;

export default function CompliancePage() {
  const { signer } = useWallet();
  const me = signer.company;
  const { data } = useAsync(async () => {
    if (!me) return null;
    const company = await findMyCompany(me.publicKey);
    return company ? { company, listings: await myListings(company.id) } : null;
  }, [me?.publicKey]);
  const [selected, setSelected] = useState<number | null>(null);

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
  if (!data.listings.length)
    return (
      <main className="page">
        <div className="empty">
          <div style={{ fontWeight: 800 }}>No raises yet</div>
          <div className="muted">Compliance tools appear once you open a raise.</div>
        </div>
      </main>
    );
  const listing = data.listings.find((l) => l.raise.id === selected) ?? data.listings.at(-1)!;

  return (
    <main className="page" style={{ maxWidth: 1080 }}>
      <div>
        <div className="label">{data.company.name}</div>
        <h1 className="h1" style={{ marginTop: 6 }}>Compliance</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>
          Freeze, unfreeze or claw back share tokens for this raise. Every action needs a reason, which is recorded on
          Stellar with the transaction. Only the raise&apos;s compliance account can act; dvdnd has no such power.
        </p>
      </div>
      {data.listings.length > 1 && (
        <div className="seg" role="group" aria-label="Raise" style={{ alignSelf: "flex-start" }}>
          {data.listings.map((l) => (
            <button key={l.raise.id} aria-pressed={l.raise.id === listing.raise.id} onClick={() => setSelected(l.raise.id)}>
              Raise {l.raise.id}
            </button>
          ))}
        </div>
      )}
      <Console key={listing.raise.id} listing={listing} me={me} />
    </main>
  );
}

function Console({ listing, me }: { listing: Listing; me: Signer }) {
  const r = listing.raise;
  const isCompliance = r.terms.compliance === me.publicKey;
  const { data: list, reload: reloadHolders } = useAsync(() => holders(r), [r.id]);
  const { data: log, reload: reloadLog } = useAsync(() => auditLog(r, [r.terms.compliance, r.company]), [r.id]);
  const [action, setAction] = useState<{ holder: Holder; kind: "freeze" | "unfreeze" | "clawback" } | null>(null);
  const [agent, setAgent] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ title: string; hash: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inLockup = lockedUp(r);

  async function run(title: string, fn: () => Promise<{ hash: string }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      setDone({ title, hash: res.hash });
      setAction(null);
      await Promise.all([reloadHolders(), reloadLog()]);
    } catch (e) {
      setError(errorText(e, "offering"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid-cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", borderTop: "2px solid var(--line)" }}>
        {[
          ["Exemption", EXEMPTION_LABEL[r.terms.exemption]],
          ["Holders", `${r.holders} of ${r.terms.max_holders}`],
          ["Lock-up", inLockup ? `until ${at(r.terms.lockup_until)}` : "ended"],
          ["Compliance account", isCompliance ? "You" : short(r.terms.compliance)],
        ].map(([k, v]) => (
          <div key={k} style={{ padding: "14px 14px 14px 0" }}>
            <div className="label">{k}</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      {!isCompliance && (
        <div className="banner">
          Compliance for this raise is held by {short(r.terms.compliance)}. Sign in with that account to act; this view is read-only.
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="h2">Holders</h2>
        {!list ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : !list.length ? (
          <div className="empty">No holders yet. They appear once investors claim their tokens.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="r">In wallet</th>
                  <th className="r">In vault</th>
                  <th>Status</th>
                  {isCompliance && <th />}
                </tr>
              </thead>
              <tbody>
                {list.map((h) => (
                  <tr key={h.account}>
                    <td>
                      <a className="mono" href={`${NETWORK.explorer}/account/${h.account}`} target="_blank" rel="noreferrer">
                        {short(h.account)} ↗
                      </a>
                    </td>
                    <td className="r num">{fmt(h.wallet, 2)}</td>
                    <td className="r num">{fmt(h.locked, 2)}</td>
                    <td>
                      {h.authorized ? (
                        <span className="pill pill-green">Active</span>
                      ) : (
                        <span className="pill pill-amber">{inLockup ? "Frozen · lock-up" : "Frozen"}</span>
                      )}
                    </td>
                    {isCompliance && (
                      <td className="r" style={{ whiteSpace: "nowrap" }}>
                        {h.authorized ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => setAction({ holder: h, kind: "freeze" })}>Freeze</button>
                        ) : (
                          <button className="btn btn-secondary btn-sm" disabled={inLockup} title={inLockup ? "Can't unfreeze during lock-up" : undefined} onClick={() => setAction({ holder: h, kind: "unfreeze" })}>
                            Unfreeze
                          </button>
                        )}{" "}
                        <button className="btn btn-secondary btn-sm" disabled={h.wallet <= 0} title={h.wallet <= 0 ? "Only tokens in the wallet can be clawed back" : undefined} onClick={() => setAction({ holder: h, kind: "clawback" })}>
                          Claw back
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {action && <ActionForm key={`${action.kind}-${action.holder.account}`} {...action} busy={busy} onCancel={() => setAction(null)} onSubmit={(reason, amount) =>
          run(
            `${ACTION_LABEL[action.kind]} ${short(action.holder.account)}`,
            () =>
              action.kind === "freeze"
                ? offering.freezeHolder(me, r.id, action.holder.account, reason)
                : action.kind === "unfreeze"
                  ? offering.unfreezeHolder(me, r.id, action.holder.account, reason)
                  : offering.clawback(me, r.id, action.holder.account, toUnits(amount), reason),
          )
        } />}
        {done && <Toast kind="ok" title={done.title}><TxLink hash={done.hash} /></Toast>}
        {error && <Toast kind="error" title="That didn't go through">{error}</Toast>}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="h2">Audit log</h2>
        {!log ? (
          <div className="skeleton" style={{ height: 80 }} />
        ) : !log.length ? (
          <div className="empty">No compliance actions on this raise.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e) => (
                  <tr key={e.hash}>
                    <td className="num">{when(e.at)}</td>
                    <td>
                      {ACTION_LABEL[e.action]} {e.holder && <span className="mono">{short(e.holder)}</span>}
                      {e.amount !== undefined && <> · {fmt(e.amount, 2)} tokens</>}
                    </td>
                    <td>{e.reason ?? "—"}</td>
                    <td className="mono">{short(e.by)}</td>
                    <td><TxLink hash={e.hash} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isCompliance && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
          <h2 className="h2">Hand the role to a transfer agent</h2>
          <p className="muted" style={{ margin: 0 }}>The new account takes over freezing, unfreezing and clawbacks for this raise. You lose them.</p>
          <label className="field">
            <span>Agent&apos;s Stellar address</span>
            <span className="input-wrap" data-error={Boolean(agent) && !StrKey.isValidEd25519PublicKey(agent.trim())}>
              <input id="agent" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="G…" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
            </span>
          </label>
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy || !StrKey.isValidEd25519PublicKey(agent.trim())} onClick={() => run(`Compliance handed to ${short(agent.trim())}`, () => offering.setRaiseCompliance(me, r.id, agent.trim()))}>
            Hand over
          </button>
        </section>
      )}
    </>
  );
}

function ActionForm({ holder, kind, busy, onCancel, onSubmit }: { holder: Holder; kind: "freeze" | "unfreeze" | "clawback"; busy: boolean; onCancel: () => void; onSubmit: (reason: string, amount: number) => void }) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(String(holder.wallet));
  const amt = Number(amount);
  const valid = reason.trim().length > 0 && (kind !== "clawback" || (amt > 0 && amt <= holder.wallet));
  return (
    <div style={{ background: "var(--surface)", padding: 16, display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
      <div style={{ fontWeight: 700 }}>
        {kind === "freeze" ? "Freeze" : kind === "unfreeze" ? "Unfreeze" : "Claw back from"} <span className="mono">{short(holder.account)}</span>
      </div>
      {kind === "clawback" && (
        <label className="field">
          <span>Tokens (in wallet: {fmt(holder.wallet, 2)})</span>
          <span className="input-wrap">
            <input id="clawAmount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </span>
        </label>
      )}
      <label className="field">
        <span>Reason (recorded on Stellar)</span>
        <span className="input-wrap">
          <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Court order 2026/114, holder moved to the US" style={{ fontFamily: "var(--font-sans)", fontSize: 14 }} />
        </span>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={!valid || busy} onClick={() => onSubmit(reason.trim(), amt)}>
          {busy ? "Signing…" : "Confirm"}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
