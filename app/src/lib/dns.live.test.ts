// Opt-in: LIVE=1 pnpm vitest run dns.live
import { describe, expect, it } from "vitest";
import { checkDomain, lookupTxt } from "./dns";

describe.skipIf(!process.env.LIVE)("DNS over HTTPS", () => {
  it("reads real TXT records", async () => {
    const records = await lookupTxt("google.com");
    expect(records.some((r) => r.startsWith("v=spf1"))).toBe(true);
  });

  it("does not verify a domain without the record", async () => {
    const r = await checkDomain("example.com", 1, "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7");
    expect(r.verified).toBe(false);
  });
});
