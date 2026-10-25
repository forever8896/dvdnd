// Opt-in: LIVE=1 pnpm vitest run gleif.live
import { describe, expect, it } from "vitest";
import { checkLei } from "./gleif";

describe.skipIf(!process.env.LIVE)("GLEIF", () => {
  it("verifies a real LEI", async () => {
    const r = await checkLei("213800GG5STMYV487X21", { name: "Galp Energia", countryAlpha2: "PT" });
    console.log(r.record);
    expect(r.ok).toBe(true);
  });
});
