// Reads the live testnet deployment. Opt-in: LIVE=1 pnpm vitest run chain.live
import { describe, expect, it } from "vitest";
import { displayStatus, fromUnits, listListings, pool, RaiseState, targetYield } from "./chain";

describe.skipIf(!process.env.LIVE)("testnet reads", () => {
  it("lists raises with their companies", async () => {
    const listings = await listListings();
    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      console.log(
        l.raise.id,
        l.company.name,
        displayStatus(l.raise),
        `${fromUnits(l.raise.raised)}/${fromUnits(l.raise.max_raise)}`,
        `yield ${(targetYield(l) * 100).toFixed(1)}%`,
      );
      expect(l.company.id).toBe(l.raise.company_id);
    }
    // The seeded Andes raise went through a full cycle, dividend included.
    const paid = listings.find((l) => l.raise.state === RaiseState.Succeeded);
    expect(paid).toBeDefined();
    expect((await pool(paid!.raise.token)).total_distributed).toBeGreaterThan(0n);
  }, 30_000);
});
