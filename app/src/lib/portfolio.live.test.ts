// Opt-in: LIVE=1 INVESTOR=<G...> pnpm vitest run portfolio.live
import { describe, expect, it } from "vitest";
import { loadPortfolio } from "./portfolio";

describe.skipIf(!process.env.LIVE)("portfolio on testnet", () => {
  it("reads holdings, locks and escrow for an investor", async () => {
    const p = await loadPortfolio(process.env.INVESTOR ?? "GBXKSDTSMTUW5URORI4I2Y6W2IMQ5APUNLF4GANYWTDUUMH2T64QQOTV");
    for (const h of p.holdings) console.log(h.listing.company.name, { wallet: h.wallet, locked: h.locked, pending: h.pending, claimable: h.claimable });
    console.log(p.totals);
    expect(p.holdings.length).toBeGreaterThan(0);
  }, 60_000);
});
