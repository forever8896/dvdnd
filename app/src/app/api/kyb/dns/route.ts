// Checks a company's DNS verification record without changing anything, so
// the onboarding screen can show live status while DNS propagates.

import { NextResponse } from "next/server";
import { getCompany, parseProfile } from "@/lib/chain";
import { checkDomain, expectedRecord, normalizeDomain, recordNames } from "@/lib/dns";

export async function GET(req: Request) {
  const companyId = Number(new URL(req.url).searchParams.get("companyId"));
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return NextResponse.json({ error: "Missing companyId." }, { status: 400 });
  }
  let company;
  try {
    company = await getCompany(companyId);
  } catch {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  const domain = normalizeDomain(parseProfile(company).website);
  if (!domain) return NextResponse.json({ error: "The company profile has no website domain." }, { status: 400 });

  const instructions = { domain, names: recordNames(domain), value: expectedRecord(company.id, company.owner) };
  try {
    return NextResponse.json({ ...instructions, check: await checkDomain(domain, company.id, company.owner) });
  } catch (e) {
    return NextResponse.json({ ...instructions, error: e instanceof Error ? e.message : "DNS lookup failed." }, { status: 502 });
  }
}
