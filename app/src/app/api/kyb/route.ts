// Company ownership verification.
//
// Real: domain control. The company publishes a DNS TXT record binding its
// website's domain to its dvdnd registration and wallet, and we look it up
// over DNS-over-HTTPS. The domain is read from the company's on-chain profile,
// never from the request.
//
// Simulated: the registry match. A production check would query the company
// registry (directors, beneficial owners) and run a KYB vendor; here the
// declared registry number and director are recorded as evidence.
//
// On success the evidence hash is recorded in the registry contract with the
// platform admin key.

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { CONTRACTS } from "@/lib/config";
import { CompanyStatus, getCompany, parseProfile, sc } from "@/lib/chain";
import { checkDomain, normalizeDomain } from "@/lib/dns";
import { invoke, Keypair, keypairSigner, TxError } from "@/lib/stellar";

export async function POST(req: Request) {
  const secret = process.env.DVDND_ADMIN_SECRET;
  if (!secret) return NextResponse.json({ error: "Verification is not configured." }, { status: 500 });

  let body: { companyId?: number; registryNumber?: string; director?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { companyId, registryNumber, director } = body;
  if (!companyId || !registryNumber?.trim() || !director?.trim()) {
    return NextResponse.json({ error: "Enter the registry number and the director's name." }, { status: 400 });
  }

  let company;
  try {
    company = await getCompany(companyId);
  } catch {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  if (company.status !== CompanyStatus.Pending) {
    return NextResponse.json({ error: "This company is already verified." }, { status: 409 });
  }

  const domain = normalizeDomain(parseProfile(company).website);
  if (!domain) {
    return NextResponse.json({ error: "The company profile has no website domain to verify." }, { status: 400 });
  }
  let dns;
  try {
    dns = await checkDomain(domain, company.id, company.owner);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DNS lookup failed." }, { status: 502 });
  }
  if (!dns.verified) {
    return NextResponse.json({ error: `The DNS record wasn't found on ${domain} yet.`, dns }, { status: 422 });
  }

  try {
    const evidence = JSON.stringify({
      companyId: company.id,
      owner: company.owner,
      domain,
      dnsRecord: dns.expected,
      dnsFoundAt: dns.foundAt,
      registryNumber: registryNumber.trim(),
      director: director.trim(),
      checkedAt: new Date().toISOString(),
    });
    const kybHash = createHash("sha256").update(evidence).digest();
    const admin = keypairSigner(Keypair.fromSecret(secret));
    const res = await invoke(admin, CONTRACTS.registry, "verify", [sc.u32(company.id), sc.bytes(kybHash)]);
    return NextResponse.json({ hash: res.hash, kybHash: kybHash.toString("hex"), dns });
  } catch (e) {
    const message = e instanceof TxError ? e.message : "Couldn't record the verification on-chain.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
