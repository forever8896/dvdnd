// SEP-10 sign-in and a SEP-24 deposit start against SDF's test anchor.
// Opt-in: LIVE=1 pnpm vitest run anchor.live
import { describe, expect, it } from "vitest";
import { signIn, start, status } from "./anchor";
import { friendbot, Keypair, keypairSigner } from "./stellar";

describe.skipIf(!process.env.LIVE)("test anchor", () => {
  it("signs in and opens a USDC deposit", async () => {
    const kp = Keypair.random();
    await friendbot(kp.publicKey());
    const token = await signIn(keypairSigner(kp));
    expect(token.split(".")).toHaveLength(3); // a JWT
    const { url, id } = await start("deposit", token, kp.publicKey());
    expect(new URL(url).hostname).toMatch(/testanchor\.stellar\.org$/);
    expect((await status(token, id)).status).toBe("incomplete");
  }, 90_000);
});
