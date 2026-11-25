import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { buildPoseidon } from "circomlibjs";
import { addIndexedLeaf, CREDENTIAL_FIELD, mergeCredentialLeaves, parseCredentialSnapshot, verifyCredentialLeaves } from "./credential-recovery";

const mocks = vi.hoisted(() => ({ read: vi.fn(), getHealth: vi.fn(), getEvents: vi.fn() }));
vi.mock("./stellar", () => ({ read: mocks.read, server: { getHealth: mocks.getHealth, getEvents: mocks.getEvents } }));
import { CONTRACTS, NETWORK } from "./config";
import { buildCredentialSnapshot, fetchLeaves, merklePath } from "./zk";

function event(index: number, leaf: bigint) {
  return {
    topic: [nativeToScVal("gate", { type: "symbol" }), nativeToScVal("credential", { type: "symbol" }), nativeToScVal(index, { type: "u32" })],
    value: xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: nativeToScVal("leaf", { type: "symbol" }), val: nativeToScVal(leaf, { type: "u256" }) })]),
  };
}
const all = [11n, 22n, 33n];
const rootOf = async (leaves: bigint[]) => (await merklePath(leaves, 0)).root;
async function snapshot(leaves: bigint[]) {
  return { version: 1, network: NETWORK.name, gate: CONTRACTS.gate, leaves: leaves.map(String), root: String(await rootOf(leaves)) };
}

describe("fetchLeaves", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_CREDENTIAL_SNAPSHOT_URL", "https://example.invalid/credentials.json");
    const root = await rootOf(all);
    mocks.read.mockImplementation(async (_contract: string, method: string) => {
      if (method === "next_index") return all.length;
      if (method === "root") return root;
      if (method === "admin") return "admin";
      throw new Error(`Unexpected method ${method}`);
    });
    mocks.getHealth.mockResolvedValue({ oldestLedger: NETWORK.gateFromLedger + 100, latestLedger: NETWORK.gateFromLedger + 200 });
    mocks.getEvents.mockResolvedValue({ events: [event(2, 33n)] });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("scans the retained suffix, merges it with a snapshot and recovers a valid new path", async () => {
    const stored = await snapshot([11n, 22n]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => stored }));
    const leaves = await fetchLeaves();
    expect(mocks.getEvents).toHaveBeenCalledWith(expect.objectContaining({ startLedger: NETWORK.gateFromLedger + 100 }));
    expect(leaves).toEqual(all);
    expect((await merklePath(leaves, 2)).root).toBe(await rootOf(all));
  });
  it("rejects a self-consistent snapshot whose reconstructed root differs from the chain", async () => {
    const corrupt = await snapshot([11n, 99n]);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("credentials.json")
      ? { ok: true, json: async () => corrupt }
      : { ok: false, status: 503 }));
    await expect(fetchLeaves()).rejects.toThrow(/root mismatch/);
  });
  it("fails when history and the retained suffix have a gap", async () => {
    const incomplete = await snapshot([11n]);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("credentials.json")
      ? { ok: true, json: async () => incomplete }
      : { ok: false, status: 503 }));
    await expect(fetchLeaves()).rejects.toThrow(/Missing credential at index 1/);
  });
  it("recovers a complete Horizon history when the RPC scan starts late", async () => {
    vi.stubEnv("NEXT_PUBLIC_CREDENTIAL_SNAPSHOT_URL", "");
    const records = all.map(leaf => ({ type: "invoke_host_function", transaction_successful: true, parameters: [
      nativeToScVal(CONTRACTS.gate, { type: "address" }), nativeToScVal("add_credential", { type: "symbol" }), nativeToScVal(leaf, { type: "u256" }),
    ].map(p => ({ value: p.toXDR("base64") })) }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ _embedded: { records } }) }));
    expect(await fetchLeaves()).toEqual(all);
  });
  it("refreshes a local snapshot without needing a hosted copy or old events", async () => {
    const stored = await snapshot([11n, 22n]);
    const fetchMock = vi.fn().mockRejectedValue(new Error("no HTTP archive"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await buildCredentialSnapshot(stored)).toEqual(await snapshot(all));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a snapshot for another gate and fails closed without history", async () => {
    const stored = { ...await snapshot([11n, 22n]), gate: "other" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchLeaves(stored)).rejects.toThrow(/not for this network and gate/);
  });
  it("retries when a credential is added during a scan", async () => {
    const first = [11n, 22n];
    const firstRoot = await rootOf(first);
    const lastRoot = await rootOf(all);
    let countReads = 0;
    let rootReads = 0;
    mocks.read.mockImplementation(async (_contract: string, method: string) => {
      if (method === "next_index") return countReads++ === 0 ? 2 : 3;
      if (method === "root") return rootReads++ === 0 ? firstRoot : lastRoot;
      throw new Error(`Unexpected method ${method}`);
    });
    const stored = await snapshot(first);
    expect(await fetchLeaves(stored)).toEqual(all);
    expect(mocks.getEvents).toHaveBeenCalledTimes(2);
  });
});

describe("credential reconstruction", () => {
  it("recovers a newly issued credential when early RPC events have expired", async () => {
    const leaves = [11n, 22n, 33n, 44n];
    const root = await rootOf(leaves);
    const recovered = mergeCredentialLeaves([11n, 22n], new Map([[2, 33n], [3, 44n]]), leaves.length);
    expect(await verifyCredentialLeaves(recovered, leaves.length, root, rootOf)).toEqual(leaves);
    expect(await merklePath(recovered, 3)).toEqual(await merklePath(leaves, 3));
  });
  it("rejects missing indices", () => {
    expect(() => mergeCredentialLeaves([11n], new Map([[2, 33n]]), 3)).toThrow(/Missing credential at index 1/);
  });
  it("rejects conflicting historical and recent leaves", () => {
    expect(() => mergeCredentialLeaves([11n, 22n], new Map([[1, 99n]]), 2)).toThrow(/conflicts/);
  });
  it("rejects same-length tampered and reordered histories", async () => {
    const root = await rootOf(all);
    for (const leaves of [[11n, 99n, 33n], [22n, 11n, 33n]]) {
      await expect(verifyCredentialLeaves(leaves, 3, root, rootOf)).rejects.toThrow(/root mismatch/);
    }
  });
  it("rejects noncanonical field elements", () => {
    expect(() => mergeCredentialLeaves([CREDENTIAL_FIELD], new Map(), 1)).toThrow(/canonical/);
    expect(() => addIndexedLeaf(new Map(), 0, -1n)).toThrow(/canonical/);
  });
  it("allows identical duplicates and rejects conflicting duplicates", () => {
    const events = new Map<number, bigint>();
    addIndexedLeaf(events, 1, 22n);
    addIndexedLeaf(events, 1, 22n);
    expect(events.size).toBe(1);
    expect(() => addIndexedLeaf(events, 1, 99n)).toThrow(/Conflicting/);
  });
  it("ignores events outside the captured count", () => {
    expect(mergeCredentialLeaves([11n], new Map([[1, 22n], [2, 33n]]), 2)).toEqual([11n, 22n]);
  });
  it("validates the empty tree", async () => {
    expect(await verifyCredentialLeaves([], 0, await rootOf([]), rootOf)).toEqual([]);
  });
  it("recovers the Rust fixture and independently folds the new credential path", async () => {
    const leaves = [
      0x10c0e2da554bc67df035e00ec77dc457ad892267a641bd748feb6b8a5c1c53b2n,
      0x2b8d513832fc2920807412a43af68117050b377081d8f7d77ef282a3d383704bn,
      0x2d94933cedf6f3e2b63dc8ca729185f8db8f428ba995f33a17cec60ff4692705n,
    ];
    const expected = 0x1991f855cc308bd10dc089a6b903536721c5a3dccf3d67679febc7e70177335an;
    const recovered = mergeCredentialLeaves(leaves.slice(0, 2), new Map([[2, leaves[2]!]]), 3);
    await verifyCredentialLeaves(recovered, 3, expected, rootOf);
    const path = await merklePath(recovered, 2);
    expect(path.path_elements).toHaveLength(16);
    expect(path.path_indices).toHaveLength(16);
    const p = await buildPoseidon();
    let node = leaves[2]!;
    for (let i = 0; i < 16; i++) {
      const sibling = BigInt(path.path_elements[i]!);
      node = p.F.toObject(p(path.path_indices[i] === "0" ? [node, sibling] : [sibling, node])) as bigint;
    }
    expect(node).toBe(expected);
    expect(path.root).toBe(expected);
    expect(await rootOf([])).toBe(0x2a7c7c9b6ce5880b9f6f228d72bf6a575a526f29c66ecceef8b753d38bba7323n);
  }, 30_000);
  it("validates snapshot identity and encoding", () => {
    const s = { version: 1, network: "testnet", gate: "gate1", leaves: ["11", "22"], root: "33" };
    expect(parseCredentialSnapshot(s, "testnet", "gate1")).toEqual({ leaves: [11n, 22n], root: 33n });
    expect(() => parseCredentialSnapshot(s, "mainnet", "gate1")).toThrow(/not for/);
    expect(() => parseCredentialSnapshot({ ...s, leaves: ["01"] }, "testnet", "gate1")).toThrow(/Malformed/);
  });
});
