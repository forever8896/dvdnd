import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, runSimulation } from ".";

describe("simulation", () => {
  const r = runSimulation(DEFAULT_PARAMS);

  it("memecoin traders lose exactly the fees", () => {
    const { sumPnl, fees } = r.meme.feesCheck;
    expect(fees).toBeGreaterThan(0);
    expect(Math.abs(sumPnl + fees)).toBeLessThan(1e-6 * fees);
  });

  it("is reproducible from the seed", () => {
    expect(runSimulation(DEFAULT_PARAMS).summary).toEqual(r.summary);
    expect(runSimulation({ ...DEFAULT_PARAMS, seed: 7 }).summary).not.toEqual(r.summary);
  });

  it("charges a flat listing fee per raise, never a share", () => {
    expect(r.dividend.flows.toPlatform).toBe(r.dividend.raisesOpened * DEFAULT_PARAMS.listingFee);
    expect(r.dividend.flows.toCompanies).toBeCloseTo(r.dividend.capitalRaised);
  });

  it("histograms are shares that sum to one", () => {
    for (const k of ["meme", "dividend", "realestate", "bdc"] as const) expect(r.histogram[k].reduce((s, x) => s + x, 0)).toBeCloseTo(1);
  });
});
