// Company flow against testnet and the running dev server: register, mock KYB,
// sign the agreement, issue the share token and open a raise.
// Opt-in: LIVE=1 APP_URL=http://localhost:3100 pnpm vitest run company-flow.live
import { describe, expect, it } from "vitest";
import { CompanyStatus, getCompany, getRaise, RaiseState, toUnits } from "./chain";
import { agreementText, assetCode, issueShareToken, openRaise, register, sha256, signAgreement } from "./company";
import { friendbot, Keypair, keypairSigner } from "./stellar";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";

describe.skipIf(!process.env.LIVE)("company flow on testnet", () => {
  it("onboards a company and opens a raise", async () => {
    const kp = Keypair.random();
    await friendbot(kp.publicKey());
    const owner = keypairSigner(kp);

    const name = "Test Cafe Lisboa";
    const reg = await register(owner, name, 620, {
      sector: "Food",
      city: "Lisbon",
      description: "Test company from the live test.",
      netProfit: 900,
    });
    const kyb = await fetch(`${APP_URL}/api/kyb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: reg.id, registryNumber: "PT 500 000 000", director: "Ana Test", domain: "example.com" }),
    });
    expect(kyb.status, await kyb.clone().text()).toBe(200);

    const text = agreementText({ name, payoutPct: 50, periodLabel: "Annually" });
    await signAgreement(owner, reg.id, await sha256(text), 5000, 31_536_000);
    expect((await getCompany(reg.id)).status).toBe(CompanyStatus.Active);

    const steps: string[] = [];
    const { token } = await issueShareToken(assetCode(name), (s) => steps.push(s));
    const raise = await openRaise(owner, {
      companyId: reg.id,
      token,
      price: toUnits(1),
      min: toUnits(100),
      max: toUnits(2500),
      deadline: Math.floor(Date.now() / 1000) + 7 * 86400,
    });
    console.log("company", reg.id, "token", token, "raise", raise.raiseId, raise.hash);
    expect((await getRaise(raise.raiseId)).state).toBe(RaiseState.Open);
  }, 180_000);
});
