// Looks up a company's LEI at GLEIF and compares it with its dvdnd
// registration, without changing anything.

import { NextResponse } from "next/server";
import { countryCode, getCompany, parseProfile } from "@/lib/chain";
import { checkLei } from "@/lib/gleif";

export async function GET(req: Request) {
  const companyId = Number(new URL(req.url).searchParams.get("companyId"));
  if (!Number.isInteger(companyId) || companyId <= 0) return NextResponse.json({ error: "Missing companyId." }, { status: 400 });
  let company;
  try {
    company = await getCompany(companyId);
  } catch {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  const lei = parseProfile(company).lei;
  if (!lei) return NextResponse.json({ lei: null });
  try {
    return NextResponse.json({ lei, ...(await checkLei(lei, { name: company.name, countryAlpha2: countryCode(company.country) })) });
  } catch (e) {
    return NextResponse.json({ lei, error: e instanceof Error ? e.message : "GLEIF lookup failed." }, { status: 502 });
  }
}
