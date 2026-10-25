// The plain-language profit-share agreement a company signs. Its SHA-256 goes
// on-chain, and the text is fully determined by on-chain fields (name, payout
// share, period), so anyone can rebuild it and check the hash. No imports: the
// seeding scripts load this file directly with Node.

export const PERIODS = [
  { label: "Annually", secs: 31_536_000 },
  { label: "Semi-annually", secs: 15_768_000 },
  { label: "Quarterly", secs: 7_884_000 },
];

export const periodLabel = (secs: number | bigint) =>
  PERIODS.find((p) => p.secs === Number(secs))?.label ?? `Every ${Math.round(Number(secs) / 86400)} days`;

export function agreementText(c: { name: string; payoutPct: number; periodLabel: string }) {
  return [
    `dvdnd profit-share agreement`,
    `Company: ${c.name}`,
    `1. The company commits ${c.payoutPct}% of its audited yearly net profit to holders of its dvdnd token.`,
    `2. Dividends are paid in USDC on Stellar, ${c.periodLabel.toLowerCase()}, to tokens locked for the full period, pro-rata.`,
    `3. The commitment lasts for as long as the business operates.`,
    `4. If the business is sold, the obligation transfers to the buyer.`,
    `5. Late payments are flagged publicly on the company's listing.`,
    `6. The company holds no tokens and receives the full raise only if the minimum is reached. It pays dvdnd a flat listing fee per raise, never a share of what is raised.`,
  ].join("\n");
}

/** The agreement as signed, rebuilt from a company's on-chain record. */
export const signedAgreement = (c: { name: string; payout_bps: number; period_secs: number | bigint }) =>
  agreementText({ name: c.name, payoutPct: c.payout_bps / 100, periodLabel: periodLabel(c.period_secs) });
