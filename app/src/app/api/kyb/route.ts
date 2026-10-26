// Company ownership verification.
//
// Real: domain control. The company publishes a DNS TXT record binding its
// website's domain to its dvdnd registration and wallet, and we look it up
// over DNS-over-HTTPS. The domain is read from the company's on-chain profile,
// never from the request.
//
// Real, when the company gave an LEI: the GLEIF record must be active, issued,
// in the company's country and under a matching legal name.
//
// Real, when the company was found in a national register at onboarding: the
// register is queried again by number; the company must be active, in the
// same country and under the same name.
//
// Self-declared otherwise: the registry number and director are recorded as
// evidence. A production check would query the national registry (directors,
// beneficial owners) and run a KYB vendor.
//
// On success the evidence hash is recorded in the registry contract with the
// platform admin key.

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { CONTRACTS, IS_TESTNET } from "@/lib/config";
import { CompanyStatus, countryCode, getCompany, parseProfile, sc } from "@/lib/chain";
import { checkDomain, normalizeDomain } from "@/lib/dns";
import { checkLei, type LeiRecord } from "@/lib/gleif";
import { lookupById, sameName, type RegistryRecord } from "@/lib/registries";
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
  if (!companyId || !director?.trim()) {
    return NextResponse.json({ error: "Enter your name as listed director." }, { status: 400 });
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

  const profile = parseProfile(company);
  let lei: LeiRecord | null = null;
  let national: RegistryRecord | null = null;
  if (profile.lei) {
    try {
      const check = await checkLei(profile.lei, { name: company.name, countryAlpha2: countryCode(company.country) });
      if (!check.ok) return NextResponse.json({ error: check.problems.join(" "), lei: check }, { status: 422 });
      lei = check.record;
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "GLEIF lookup failed." }, { status: 502 });
    }
  } else if (profile.registry) {
    // Found in a national register at onboarding: check it again at the source.
    try {
      national = await lookupById(profile.registry.source, profile.registry.id);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "The company register didn't answer." }, { status: 502 });
    }
    const problems = !national
      ? [`${profile.registry.idLabel} ${profile.registry.id} isn't in ${profile.registry.name}.`]
      : [
          ...(national.active ? [] : ["The register lists the company as closed."]),
          ...(national.country === company.country ? [] : ["The register's country doesn't match the registration."]),
          ...(sameName(national.name, company.name) ? [] : [`The register's name is "${national.name}", not "${company.name}".`]),
        ];
    if (problems.length) return NextResponse.json({ error: problems.join(" ") }, { status: 422 });
  } else if (!IS_TESTNET) {
    // On mainnet the registry check must be real: GLEIF or a national register.
    return NextResponse.json({ error: "Register the company through the company search, or with its LEI, to verify it on mainnet." }, { status: 422 });
  } else if (!registryNumber?.trim()) {
    return NextResponse.json({ error: "Enter the registry number." }, { status: 400 });
  }

  const domain = normalizeDomain(profile.website);
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
      lei: lei && { lei: lei.lei, legalName: lei.legalName, registeredAs: lei.registeredAs, country: lei.country },
      registryNumber: lei?.registeredAs ?? national?.id ?? registryNumber?.trim(),
      registrySource: lei ? "GLEIF" : national ? national.registry : "self-declared",
      director: director.trim(),
      checkedAt: new Date().toISOString(),
    });
    const kybHash = createHash("sha256").update(evidence).digest();
    const admin = keypairSigner(Keypair.fromSecret(secret));
    const res = await invoke(admin, CONTRACTS.registry, "verify", [sc.u32(company.id), sc.bytes(kybHash)]);
    return NextResponse.json({ hash: res.hash, kybHash: kybHash.toString("hex"), dns, lei });
  } catch (e) {
    const message = e instanceof TxError ? e.message : "Couldn't record the verification on-chain.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
