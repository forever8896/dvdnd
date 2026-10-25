// Is this Stellar address on OFAC's sanctions list? Used by the app before
// actions; the issuer and verifier check again on the server.

import { NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { isSanctioned } from "@/lib/ofac";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!StrKey.isValidEd25519PublicKey(address)) return NextResponse.json({ error: "Invalid Stellar address." }, { status: 400 });
  try {
    return NextResponse.json({ sanctioned: await isSanctioned(address) });
  } catch {
    return NextResponse.json({ error: "The sanctions list is unavailable right now. Try again shortly." }, { status: 503 });
  }
}
