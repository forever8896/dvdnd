// Investor flow against testnet and the running dev server: eligibility,
// add money and invest.
// Opt-in: LIVE=1 DVDND_ADMIN_SECRET=… pnpm vitest run investor-flow.live
// Issues the credential the way the server does after an approved identity
// check (the issuer is called directly, standing in for a Didit decision).
import { describe, expect, it } from "vitest";
import { issueCredential } from "./issuer";
import { contribution, eligibleUntil, gate, offering, toUnits } from "./chain";
import { balances, buyUsdc, friendbot, Keypair, keypairSigner } from "./stellar";
import { credentialLeaf, fetchLeaves, proveResidence, randomSecret, secretCommitment } from "./zk";

const ARTIFACTS = { wasm: "public/zk/residence.wasm", zkey: "public/zk/residence_final.zkey" };

describe.skipIf(!process.env.LIVE || !process.env.DVDND_ADMIN_SECRET)("investor flow on testnet", () => {
  it("issues a credential, proves residence and registers on-chain", async () => {
    const kp = Keypair.random();
    await friendbot(kp.publicKey());
    const signer = keypairSigner(kp);

    // The issuer only gets Poseidon(secret) and builds the leaf from the country it accepted.
    const secret = randomSecret();
    const body = await issueCredential(620, await secretCommitment(secret));
    expect(body.country).toBe(620);
    const leaf = await credentialLeaf(620, body.expiry, secret);
    expect(body.leaf).toBe(leaf.toString());

    const leaves = await fetchLeaves();
    expect(leaves[body.index]).toBe(leaf);
    const cred = { country: 620, expiry: body.expiry, secret: secret.toString(), leaf: leaf.toString(), index: body.index };
    const proof = await proveResidence(cred, kp.publicKey(), leaves, Math.floor(Date.now() / 1000), ARTIFACTS);
    const tx = await gate.verifyAndRegister(signer, proof);
    console.log("credential", body.hash, "verified", tx.hash);
    expect(await eligibleUntil(kp.publicKey())).toBeGreaterThan(Date.now() / 1000);

    // Add money (XLM -> USDC path payment) and invest in the open raise.
    const raiseId = Number(process.env.RAISE_ID ?? 4);
    const buy = await buyUsdc(signer, 150);
    expect((await balances(kp.publicKey())).usdc).toBeGreaterThanOrEqual(150);
    const inv = await offering.invest(signer, raiseId, toUnits(100));
    console.log("bought", buy.hash, "invested", inv.hash);
    expect(await contribution(raiseId, kp.publicKey())).toBe(toUnits(100));
  }, 180_000);

  it("refuses US residents at the issuer", async () => {
    await expect(issueCredential(840, 123n)).rejects.toMatchObject({ status: 403, us: true });
  });
});
