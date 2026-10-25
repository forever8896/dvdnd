// Minimal types for the ZK libraries, which ship without declarations.

declare module "circomlibjs" {
  type Poseidon = ((inputs: bigint[]) => Uint8Array) & {
    F: { toObject: (x: Uint8Array) => bigint };
  };
  export function buildPoseidon(): Promise<Poseidon>;
}

declare module "snarkjs" {
  export const groth16: {
    fullProve: (
      input: Record<string, string | string[]>,
      wasm: string,
      zkey: string,
    ) => Promise<{
      proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
      publicSignals: string[];
    }>;
  };
}
