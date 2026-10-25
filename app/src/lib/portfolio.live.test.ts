// Opt-in: LIVE=1 INVESTOR=<G...> pnpm vitest run portfolio.live
import { describe, expect, it } from "vitest";
import { loadPortfolio } from "./portfolio";

describe.skipIf(!process.env.LIVE)("portfolio on testnet", () => {
  it("reads holdings, locks and escrow for an investor", async () => {
    // Default: investor-eve, an Andes holder under lock-up.
    const p = await loadPortfolio(process.env.INVESTOR ?? "GDVMPW26YZP5NGJGDRTT6AL7V63F2YAASILK2KZGOV2LPJE5KCSZTASN");
    for (const h of p.holdings) console.log(h.listing.company.name, { wallet: h.wallet, locked: h.locked, pending: h.pending, claimable: h.claimable });
    console.log(p.totals);
    expect(p.holdings.length).toBeGreaterThan(0);
    // Andes is in lock-up: tokens earn in the vault while the wallet is frozen.
    const andes = p.holdings.find((h) => h.listing.company.name.startsWith("Andes"));
    expect(andes?.locked).toBeGreaterThan(0);
    expect(andes?.frozen).toBe(true);
  }, 60_000);
});
