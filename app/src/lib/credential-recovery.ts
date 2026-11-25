/** Reconstruct a contiguous credential prefix from historical leaves and indexed events. */
export const CREDENTIAL_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const CREDENTIAL_CAPACITY = 1 << 16;

export function assertCredentialLeaf(leaf: bigint): void {
  if (typeof leaf !== "bigint" || leaf < 0n || leaf >= CREDENTIAL_FIELD) {
    throw new Error("Invalid credential leaf (not a canonical BN254 field element).");
  }
}

export function assertCredentialCount(count: number): void {
  if (!Number.isInteger(count) || count < 0 || count > CREDENTIAL_CAPACITY) {
    throw new Error("Invalid on-chain credential count.");
  }
}

export function addIndexedLeaf(events: Map<number, bigint>, index: number, leaf: bigint): void {
  if (!Number.isInteger(index) || index < 0 || index >= CREDENTIAL_CAPACITY) {
    throw new Error("Invalid credential event index.");
  }
  assertCredentialLeaf(leaf);
  if (events.has(index) && events.get(index) !== leaf) {
    throw new Error(`Conflicting credential events at index ${index}.`);
  }
  events.set(index, leaf);
}

export function mergeCredentialLeaves(
  prefix: readonly bigint[], events: ReadonlyMap<number, bigint>, count: number,
): bigint[] {
  assertCredentialCount(count);
  assertCredentialCount(prefix.length);
  const leaves = prefix.slice(0, count);
  prefix.forEach(assertCredentialLeaf);
  for (const [index, leaf] of events) {
    if (!Number.isInteger(index) || index < 0 || index >= CREDENTIAL_CAPACITY) {
      throw new Error("Invalid credential event index.");
    }
    assertCredentialLeaf(leaf);
    if (index >= count) continue;
    if (index < leaves.length && leaves[index] !== leaf) {
      throw new Error(`Historical credential conflicts with event at index ${index}.`);
    }
  }
  for (let index = leaves.length; index < count; index++) {
    const leaf = events.get(index);
    if (leaf === undefined) throw new Error(`Missing credential at index ${index}.`);
    leaves.push(leaf);
  }
  return leaves;
}

export async function verifyCredentialLeaves(
  leaves: readonly bigint[], count: number, expectedRoot: bigint,
  computeRoot: (leaves: bigint[]) => Promise<bigint>,
): Promise<bigint[]> {
  assertCredentialCount(count);
  assertCredentialLeaf(expectedRoot);
  if (leaves.length !== count) throw new Error(`Incomplete credential tree (${leaves.length}/${count}).`);
  leaves.forEach(assertCredentialLeaf);
  if (await computeRoot([...leaves]) !== expectedRoot) {
    throw new Error("Credential tree root mismatch: refusing to generate an invalid proof.");
  }
  return [...leaves];
}

/** Decode a snapshot as untrusted input; the caller must also verify its root. */
export function parseCredentialSnapshot(input: unknown, network: string, gate: string) {
  if (!input || typeof input !== "object") throw new Error("No usable historical credential snapshot.");
  const data = input as { version?: unknown; network?: unknown; gate?: unknown; leaves?: unknown; root?: unknown };
  if (data.version !== 1 || data.network !== network || data.gate !== gate || !Array.isArray(data.leaves)) {
    throw new Error("Credential snapshot is not for this network and gate.");
  }
  assertCredentialCount(data.leaves.length);
  const parse = (value: unknown) => {
    if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,76})$/.test(value)) throw new Error("Malformed snapshot field element.");
    const field = BigInt(value);
    assertCredentialLeaf(field);
    return field;
  };
  return { leaves: Array.from(data.leaves, parse), root: parse(data.root) };
}
