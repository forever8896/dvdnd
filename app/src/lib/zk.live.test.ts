// The credential tree rebuilt from Horizon history must match the gate's root.
// Opt-in: LIVE=1 pnpm vitest run zk.live
import { describe, expect, it } from "vitest";
import { CONTRACTS } from "./config";
import { read } from "./stellar";
import { fetchLeaves, leavesFromHistory, merklePath } from "./zk";

describe.skipIf(!process.env.LIVE)("credential tree on testnet", () => {
  it("rebuilds from history to the gate's current root", async () => {
    const [history, leaves, count, root] = await Promise.all([
      leavesFromHistory(),
      fetchLeaves(),
      read<number>(CONTRACTS.gate, "next_index"),
      read<bigint>(CONTRACTS.gate, "root"),
    ]);
    expect(history.length).toBe(Number(count));
    expect(history).toEqual(leaves);
    expect((await merklePath(history, 0)).root).toBe(BigInt(root));
    console.log(`${history.length} credentials, root matches`);
  }, 120_000);
});
