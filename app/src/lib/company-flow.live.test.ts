// Company flow against testnet and the running dev server: register, mock KYB,
// sign the agreement, issue the share token, and simulate opening a 506(c)
// raise (simulated, so test companies never show up on Discover).
// Opt-in: LIVE=1 APP_URL=http://localhost:3100 DVDND_ADMIN_SECRET=… pnpm vitest run company-flow.live
// Without the admin secret it stops after checking that KYB refuses a domain without the record.
import { describe, expect, it } from "vitest";
import { CompanyStatus, Exemption, getCompany, raiseCount, REG_D_LOCKUP_SECS, sc, termsVal, toUnits } from "./chain";
import { CONTRACTS } from "./config";
import { agreementText, assetCode, issueShareToken, register, sha256, signAgreement } from "./company";
import { buyUsdc, friendbot, invoke, Keypair, keypairSigner, read } from "./stellar";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";

describe.skipIf(!process.env.LIVE)("company flow on testnet", () => {
  it("onboards a company and can open a 506(c) raise", async () => {
    const kp = Keypair.random();
    await friendbot(kp.publicKey());
    const owner = keypairSigner(kp);

    const name = "Test Cafe Lisboa";
    const reg = await register(owner, name, 620, {
      sector: "Food",
      city: "Lisbon",
      description: "Test company from the live test.",
      website: "https://example.com",
      netProfit: 900,
    });
    // Ownership needs the DNS record, which a fresh test company can't have.
    const status = await (await fetch(`${APP_URL}/api/kyb/dns?companyId=${reg.id}`)).json();
    expect(status.value).toBe(`dvdnd-verify=${reg.id}:${kp.publicKey()}`);
    expect(status.check.verified).toBe(false);
    const kyb = await fetch(`${APP_URL}/api/kyb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: reg.id, registryNumber: "PT 500 000 000", director: "Ana Test" }),
    });
    expect(kyb.status).toBe(422);

    // Continue as the platform would after a successful check.
    const adminSecret = process.env.DVDND_ADMIN_SECRET;
    if (!adminSecret) return;
    await invoke(keypairSigner(Keypair.fromSecret(adminSecret)), CONTRACTS.registry, "verify", [
      sc.u32(reg.id),
      sc.bytes(new Uint8Array(32).fill(1)),
    ]);

    const text = agreementText({ name, payoutPct: 50, periodLabel: "Annually" });
    await signAgreement(owner, reg.id, await sha256(text), 5000, 31_536_000);
    expect((await getCompany(reg.id)).status).toBe(CompanyStatus.Active);

    const steps: string[] = [];
    const { token } = await issueShareToken(assetCode(name), (s) => steps.push(s), owner);
    await buyUsdc(owner, 12); // the flat listing fee
    const deadline = Math.floor(Date.now() / 1000) + 7 * 86400;
    const open = (lockup: number) =>
      read(CONTRACTS.offering, "open_raise", [
        sc.u32(reg.id),
        sc.address(token),
        sc.i128(toUnits(1)),
        sc.i128(toUnits(100)),
        sc.i128(toUnits(2500)),
        sc.u64(deadline),
        termsVal({
          exemption: Exemption.RegD506c,
          min_ticket: 0n,
          max_holders: 100,
          lockup_until: BigInt(deadline + lockup),
          compliance: kp.publicKey(),
        }),
      ]);
    // The next raise id comes back from the simulation; nothing is submitted.
    expect(Number(await open(REG_D_LOCKUP_SECS))).toBe((await raiseCount()) + 1);
    // Reg D needs a year of lock-up.
    await expect(open(REG_D_LOCKUP_SECS - 1)).rejects.toThrow();
    console.log("company", reg.id, "token", token, "506(c) raise simulated");
  }, 180_000);
});
