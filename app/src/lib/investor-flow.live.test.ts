// Investor flow against testnet and the running dev server: eligibility,
// add money and invest.
// Opt-in: LIVE=1 APP_URL=http://localhost:3100 pnpm vitest run investor-flow.live
import { describe, expect, it } from "vitest";
import { contribution, eligibleUntil, gate, offering, toUnits } from "./chain";
import { balances, buyUsdc, friendbot, Keypair, keypairSigner } from "./stellar";
import { credentialLeaf, fetchLeaves, proveResidence, randomSecret } from "./zk";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
const ARTIFACTS = { wasm: "public/zk/residence.wasm", zkey: "public/zk/residence_final.zkey" };

describe.skipIf(!process.env.LIVE)("investor flow on testnet", () => {
  it("issues a credential, proves residence and registers on-chain", async () => {
    const kp = Keypair.random();
    await friendbot(kp.publicKey());
    const signer = keypairSigner(kp);

    const secret = randomSecret();
    const expiry = Math.floor(Date.now() / 1000) + 365 * 86400;
    const leaf = await credentialLeaf(620, expiry, secret);
    const res = await fetch(`${APP_URL}/api/kyc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaf: leaf.toString(), country: 620, fullName: "Test Investor" }),
    });
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    const leaves = await fetchLeaves();
    expect(leaves[body.index]).toBe(leaf);
    const cred = { country: 620, expiry, secret: secret.toString(), leaf: leaf.toString(), index: body.index };
    const proof = await proveResidence(cred, kp.publicKey(), leaves, Math.floor(Date.now() / 1000), ARTIFACTS);
    const tx = await gate.verifyAndRegister(signer, proof);
    console.log("credential", body.hash, "verified", tx.hash);
    expect(await eligibleUntil(kp.publicKey())).toBeGreaterThan(Date.now() / 1000);

    // Add money (XLM -> USDC path payment) and invest in the open raise.
    const raiseId = Number(process.env.RAISE_ID ?? 3);
    const buy = await buyUsdc(signer, 150);
    expect((await balances(kp.publicKey())).usdc).toBeGreaterThanOrEqual(150);
    const inv = await offering.invest(signer, raiseId, toUnits(100));
    console.log("bought", buy.hash, "invested", inv.hash);
    expect(await contribution(raiseId, kp.publicKey())).toBe(toUnits(100));
  }, 180_000);

  it("refuses US residents at the issuer", async () => {
    const res = await fetch(`${APP_URL}/api/kyc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaf: "123", country: 840, fullName: "US Person" }),
    });
    expect(res.status).toBe(403);
  });
});
