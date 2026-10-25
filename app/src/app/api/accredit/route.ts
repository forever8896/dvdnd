// Testnet stand-in for an accreditation verification service (the role
// VerifyInvestor or Parallel Markets play for Rule 506(c)). It attests, with
// the platform key, investors who signed their accreditation statement
// on-chain, for one year. A real verifier checks income, net worth or
// licences first; this one checks nothing else, so it runs only on testnet.

import { NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { sc, selfCertification } from "@/lib/chain";
import { CONTRACTS, IS_TESTNET } from "@/lib/config";
import { invoke, Keypair, keypairSigner, TxError } from "@/lib/stellar";

function verifier() {
  const secret = process.env.DVDND_ADMIN_SECRET;
  return IS_TESTNET && secret ? keypairSigner(Keypair.fromSecret(secret)) : null;
}

/** The verifier's address, for raises that accept its attestations. */
export async function GET() {
  const v = verifier();
  return v ? NextResponse.json({ verifier: v.publicKey }) : NextResponse.json({ error: "No testnet verifier here." }, { status: 503 });
}

export async function POST(req: Request) {
  const v = verifier();
  if (!v) return NextResponse.json({ error: "The demo verifier runs only on testnet." }, { status: 503 });
  const { investor } = (await req.json().catch(() => ({}))) as { investor?: string };
  if (!investor || !StrKey.isValidEd25519PublicKey(investor)) {
    return NextResponse.json({ error: "Invalid Stellar address." }, { status: 400 });
  }
  if (!(await selfCertification(investor))) {
    return NextResponse.json({ error: "Sign your accreditation statement first." }, { status: 409 });
  }
  const until = Math.floor(Date.now() / 1000) + 365 * 86400;
  try {
    const res = await invoke(v, CONTRACTS.offering, "attest_accredited", [sc.address(v.publicKey), sc.address(investor), sc.u64(until)]);
    return NextResponse.json({ hash: res.hash, until });
  } catch (e) {
    return NextResponse.json({ error: e instanceof TxError ? e.message : "Couldn't record the attestation." }, { status: 502 });
  }
}
