// Mock KYB. In production the platform matches the applicant against the
// company registry (directors, beneficial owners), checks domain control and
// runs a KYB vendor. Here we accept the submitted evidence, hash it, and record
// the verification on-chain with the platform admin key.

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { CONTRACTS } from "@/lib/config";
import { getCompany, sc } from "@/lib/chain";
import { invoke, Keypair, keypairSigner, TxError } from "@/lib/stellar";

export async function POST(req: Request) {
  const secret = process.env.DVDND_ADMIN_SECRET;
  if (!secret) return NextResponse.json({ error: "KYB is not configured." }, { status: 500 });

  let body: { companyId?: number; registryNumber?: string; domain?: string; director?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { companyId, registryNumber, domain, director } = body;
  if (!companyId || !registryNumber?.trim() || !director?.trim()) {
    return NextResponse.json({ error: "Enter the registry number and the director's name." }, { status: 400 });
  }

  try {
    const company = await getCompany(companyId);
    const evidence = JSON.stringify({ companyId, owner: company.owner, registryNumber, domain, director, checkedAt: new Date().toISOString() });
    const kybHash = createHash("sha256").update(evidence).digest();
    const admin = keypairSigner(Keypair.fromSecret(secret));
    const res = await invoke(admin, CONTRACTS.registry, "verify", [sc.u32(companyId), sc.bytes(kybHash)]);
    return NextResponse.json({ hash: res.hash, kybHash: kybHash.toString("hex") });
  } catch (e) {
    const message = e instanceof TxError ? e.message : "Couldn't record the verification on-chain.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
