// Creates a fresh set of demo personas on testnet and stores their keys in
// app/.env.local as DEMO_PERSONAS, for the app's demo switcher. Run it before
// each demo for a clean slate (it never touches earlier personas):
//
//   cd app && npx tsx --conditions=react-server --env-file=.env.local ../scripts/testnet/demo-personas.mts
//
// Personas:
//   company  Lumen Coffee Roasters: registered, verified and agreement signed,
//            ready to open a raise (use minutes on testnet).
//   ana      Portugal. Eligible under Reg S (credential + zero-knowledge proof).
//   chloe    Germany. Eligible under Reg S.
//   ben      United States. Accredited for 506(c): signed statement + testnet verifier.
// Secret keys are written to the env file only, never printed.

import { readFileSync, writeFileSync } from "node:fs";
import { ACCREDITATION_STATEMENT } from "@/components/accreditation";
import { PERIODS } from "@/lib/agreement";
import { gate, offering, sc } from "@/lib/chain";
import { agreementText, register, sha256, signAgreement } from "@/lib/company";
import { CONTRACTS, IS_TESTNET } from "@/lib/config";
import { issueCredential } from "@/lib/issuer";
import { buyUsdc, friendbot, invoke, Keypair, keypairSigner, type Signer } from "@/lib/stellar";
import { credentialLeaf, fetchLeaves, proveResidence, randomSecret, secretCommitment } from "@/lib/zk";

if (!IS_TESTNET) throw new Error("Demo personas are testnet only.");
const adminSecret = process.env.DVDND_ADMIN_SECRET;
if (!adminSecret) throw new Error("DVDND_ADMIN_SECRET isn't set (run with --env-file=.env.local).");
const admin = keypairSigner(Keypair.fromSecret(adminSecret));
const ARTIFACTS = { wasm: "public/zk/residence.wasm", zkey: "public/zk/residence_final.zkey" };

type Persona = { id: string; role: "company" | "investor"; name: string; blurb: string; secret: string };
const log = (m: string) => console.log(`· ${m}`);

async function wallet(usdc: number): Promise<{ kp: Keypair; s: Signer }> {
  const kp = Keypair.random();
  await friendbot(kp.publicKey());
  const s = keypairSigner(kp);
  if (usdc > 0) await buyUsdc(s, usdc);
  return { kp, s };
}

async function regS(country: number, usdc: number) {
  const { kp, s } = await wallet(usdc);
  const secret = randomSecret();
  const issued = await issueCredential(country, await secretCommitment(secret));
  const leaf = await credentialLeaf(country, issued.expiry, secret);
  const cred = { country, expiry: issued.expiry, secret: secret.toString(), leaf: leaf.toString(), index: issued.index };
  const proof = await proveResidence(cred, kp.publicKey(), await fetchLeaves(), Math.floor(Date.now() / 1000), ARTIFACTS);
  await gate.verifyAndRegister(s, proof);
  return kp;
}

const personas: Persona[] = [];

log("company: Lumen Coffee Roasters");
{
  const { kp, s } = await wallet(400);
  const name = "Lumen Coffee Roasters";
  const { id } = await register(s, name, 620, {
    sector: "Coffee roasting",
    city: "Porto",
    description: "Speciality coffee roaster supplying cafés across northern Portugal, with a roastery bar in Porto. Profitable since 2019.",
    netProfit: 2400,
  });
  // The platform's verifier records the ownership check directly. A demo company has no real domain, so it
  // lists no website and the raise page shows no domain badge.
  const evidence = await sha256(JSON.stringify({ companyId: id, owner: kp.publicKey(), source: "demo persona", checkedAt: new Date().toISOString() }));
  await invoke(admin, CONTRACTS.registry, "verify", [sc.u32(id), sc.bytes(evidence)]);
  const period = PERIODS.find((p) => p.label === "Quarterly")!;
  await signAgreement(s, id, await sha256(agreementText({ name, payoutPct: 50, periodLabel: period.label })), 5000, period.secs);
  personas.push({ id: "company", role: "company", name, blurb: "Verified, agreement signed: ready to open a raise", secret: kp.secret() });
}

log("ana: Portugal, Reg S");
personas.push({ id: "ana", role: "investor", name: "Ana Ribeiro", blurb: "Lives in Portugal · eligible under Reg S", secret: (await regS(620, 1500)).secret() });

log("chloe: Germany, Reg S");
personas.push({ id: "chloe", role: "investor", name: "Chloé Wagner", blurb: "Lives in Germany · eligible under Reg S", secret: (await regS(276, 1500)).secret() });

log("ben: United States, accredited");
{
  const { kp, s } = await wallet(1500);
  await offering.selfCertify(s, await sha256(ACCREDITATION_STATEMENT.person), false);
  const until = Math.floor(Date.now() / 1000) + 365 * 86400;
  await invoke(admin, CONTRACTS.offering, "attest_accredited", [sc.address(admin.publicKey), sc.address(kp.publicKey()), sc.u64(until)]);
  personas.push({ id: "ben", role: "investor", name: "Ben Carter", blurb: "Lives in the US · verified accredited investor (506(c))", secret: kp.secret() });
}

// Replace DEMO_PERSONAS in the env file, keeping everything else.
const file = ".env.local";
const line = `DEMO_PERSONAS=${JSON.stringify(personas)}`;
const env = readFileSync(file, "utf8").split("\n").filter((l) => !l.startsWith("DEMO_PERSONAS="));
writeFileSync(file, [...env.filter((l, i) => l || i < env.length - 1), line, ""].join("\n"));
log(`saved ${personas.length} personas to app/${file} as DEMO_PERSONAS (restart the dev server to load them)`);
for (const p of personas) log(`${p.id}: ${Keypair.fromSecret(p.secret).publicKey()}`);
