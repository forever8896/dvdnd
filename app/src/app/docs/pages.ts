// The docs, in reading order. Each concept page covers what the user sees,
// what happens on-chain and the legal reasoning behind it.

export type DocPage = { slug: string; title: string; blurb: string; group: "Start" | "Investors" | "Companies" | "Protocol" };

export const DOCS: DocPage[] = [
  { slug: "", title: "How dvdnd works", blurb: "The whole lifecycle on one page: raise, escrow, lock-up, dividends, trading.", group: "Start" },
  { slug: "legal", title: "Legal model", blurb: "Software, not a broker. Reg S, Reg D 506(c), lock-ups and the holder cap.", group: "Start" },
  { slug: "verification", title: "Proving eligibility", blurb: "A hosted identity check, then a zero-knowledge proof of residence verified on Stellar.", group: "Investors" },
  { slug: "investing", title: "Investing in a raise", blurb: "Fixed price, all-or-nothing escrow, refunds and the accredited route.", group: "Investors" },
  { slug: "dividends", title: "Lock-up and dividends", blurb: "Tokens earn in the vault; only full periods are paid.", group: "Investors" },
  { slug: "trading", title: "Trading between holders", blurb: "Stellar's order book, restricted to wallets the offering authorized.", group: "Investors" },
  { slug: "money", title: "Money in and out", blurb: "USDC from test XLM, and bank transfers through a Stellar anchor.", group: "Investors" },
  { slug: "companies", title: "Listing a company", blurb: "Ownership checks, a verifiable agreement and the raise terms.", group: "Companies" },
  { slug: "compliance", title: "Compliance controls", blurb: "Per-raise freeze, clawback and an audit log anyone can read.", group: "Companies" },
  { slug: "governance", title: "Contracts and governance", blurb: "Five contracts, a 2-of-3 council and a timelock on every admin change.", group: "Protocol" },
  { slug: "simulation", title: "The simulation model", blurb: "What the simulation assumes, where the numbers come from, and its limits.", group: "Protocol" },
];

export const href = (p: DocPage) => (p.slug ? `/docs/${p.slug}` : "/docs");
