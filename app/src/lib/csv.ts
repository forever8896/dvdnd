// A raise's cap table and compliance audit log as CSV (RFC 4180), built from the data the
// compliance page already loaded.

import { holderExemption, toDecimal, type Exemption } from "./chain";
import type { ComplianceEntry, Holder } from "./compliance";

export type CsvRaise = { id: number; company: string; exemption: Exemption };

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

/** One field. Text a spreadsheet would run as a formula is defused; a comma, quote or line break is quoted. */
export function cell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const csv = (rows: string[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

const iso = (secs: number) => (secs > 0 ? new Date(secs * 1000).toISOString() : "");

const header = (raise: CsvRaise, now: Date, asset?: string) => [
  ["raise", String(raise.id)],
  ["company", raise.company],
  ...(asset ? [["asset", asset]] : []),
  ["exported_at", now.toISOString()],
  [],
];

/** One row per holder, largest holding first, under a header naming the raise, its asset and the export time. */
export function capTableCsv(raise: CsvRaise, asset: string, holders: Holder[], now = new Date()): string {
  const byHolding = holders
    .map((h) => ({ h, total: h.wallet + h.locked }))
    .sort((a, b) => (a.total === b.total ? a.h.account.localeCompare(b.h.account) : a.total > b.total ? -1 : 1));
  return csv([
    ...header(raise, now, asset),
    ["address", "balance", "locked_in_vault", "free", "frozen", "eligible_until", "exemption"],
    ...byHolding.map(({ h, total }) => [
      h.account,
      toDecimal(total),
      toDecimal(h.locked),
      toDecimal(h.authorized ? h.wallet : 0n),
      h.authorized ? "no" : "yes",
      iso(h.eligibleUntil),
      holderExemption(raise.exemption, h.eligibleUntil),
    ]),
  ]);
}

/** Every compliance action on the raise, in the order given (newest first). */
export function auditLogCsv(raise: CsvRaise, entries: ComplianceEntry[], now = new Date()): string {
  return csv([
    ...header(raise, now),
    ["action", "target", "amount", "reason", "by", "tx_hash", "timestamp"],
    ...entries.map((e) => [
      e.action,
      e.holder ?? "",
      e.amount === undefined ? "" : toDecimal(e.amount),
      e.reason ?? "",
      e.by,
      e.hash,
      e.at,
    ]),
  ]);
}
