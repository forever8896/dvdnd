// The docs, in reading order. Each concept page covers what the user sees,
// what happens on-chain and the legal reasoning behind it.

export type DocPage = {
  slug: string;
  title: string;
  /** The page's headline: one short, large claim. */
  statement: string;
  blurb: string;
  group: "Start" | "Investors" | "Companies" | "Protocol";
};

export const DOCS: DocPage[] = [
  { slug: "", title: "How dvdnd works", statement: "Real businesses. Real profit. Paid in dollars.", blurb: "The whole lifecycle on one page: raise, escrow, lock-up, dividends, trading.", group: "Start" },
  { slug: "legal", title: "Legal model", statement: "No cut. No custody. No gatekeeper.", blurb: "Software, not a broker. Reg S, Reg D 506(c), lock-ups and the holder cap.", group: "Start" },
  { slug: "verification", title: "Proving eligibility", statement: "Prove where you live. Reveal nothing else.", blurb: "A hosted identity check, then a zero-knowledge proof of residence verified on Stellar.", group: "Investors" },
  { slug: "investing", title: "Investing in a raise", statement: "One price. All or nothing.", blurb: "Fixed price, all-or-nothing escrow, refunds and the accredited route.", group: "Investors" },
  { slug: "dividends", title: "Lock-up and dividends", statement: "Paid to the patient.", blurb: "Tokens earn in the vault; only full periods are paid.", group: "Investors" },
  { slug: "trading", title: "Trading between holders", statement: "A free market, among the eligible.", blurb: "Stellar's order book, restricted to wallets the offering authorized.", group: "Investors" },
  { slug: "money", title: "Money in and out", statement: "Dollars in. Dollars out.", blurb: "USDC from test XLM, and bank transfers through a Stellar anchor.", group: "Investors" },
  { slug: "companies", title: "Listing a company", statement: "Your profit, on the record.", blurb: "Ownership checks, a verifiable agreement and the raise terms.", group: "Companies" },
  { slug: "compliance", title: "Compliance controls", statement: "Every action leaves a reason.", blurb: "Per-raise freeze, clawback and an audit log anyone can read.", group: "Companies" },
  { slug: "governance", title: "Contracts and governance", statement: "No single key changes the rules.", blurb: "Five contracts, a 2-of-3 council and a timelock on every admin change.", group: "Protocol" },
  { slug: "simulation", title: "The simulation model", statement: "Same traders. Different asset.", blurb: "What the simulation assumes, where the numbers come from, and its limits.", group: "Protocol" },
];

export const href = (p: DocPage) => (p.slug ? `/docs/${p.slug}` : "/docs");
