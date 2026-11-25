import { existsSync, readFileSync, renameSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { IS_TESTNET } from "./config";
import { buildCredentialSnapshot } from "./zk";

// Explicit opt-in testnet maintenance; does not send transactions.
it.skipIf(process.env.REFRESH_CREDENTIAL_SNAPSHOT !== "1")(
  "refreshes the public credential snapshot from root-verified history",
  async () => {
    expect(IS_TESTNET).toBe(true);
    const target = resolve("public/credential-snapshot.json");
    const temp = `${target}.${process.pid}.tmp`;
    const previous: unknown = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : null;
    const snapshot = await buildCredentialSnapshot(previous);
    try {
      writeFileSync(temp, JSON.stringify(snapshot, null, 2) + "\n", { flag: "wx" });
      renameSync(temp, target);
    } finally {
      if (existsSync(temp)) unlinkSync(temp);
    }
    expect(JSON.parse(readFileSync(target, "utf8"))).toEqual(snapshot);
  },
  120_000,
);
