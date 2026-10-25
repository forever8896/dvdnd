// Testnet stand-in for a KYC provider: accepts the declared residence instead
// of checking documents (idOS does the real check, see /api/idos). Like the
// real issuer it only gets the commitment Poseidon(secret) and builds the leaf
// itself, so the secret stays in the browser.

import { NextResponse } from "next/server";
import { IS_TESTNET } from "@/lib/config";
import { countryCode, issueCredential, IssueError, parseCommitment } from "@/lib/issuer";
import { TxError } from "@/lib/stellar";

export async function POST(req: Request) {
  if (!IS_TESTNET) {
    return NextResponse.json({ error: "The demo residence check runs only on testnet; use idOS." }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { commitment?: string; country?: number; fullName?: string };
  try {
    if (!body.fullName?.trim()) throw new IssueError("Enter your full name.", 400);
    const issued = await issueCredential(countryCode(body.country), parseCommitment(body.commitment));
    return NextResponse.json(issued);
  } catch (e) {
    if (e instanceof IssueError) return NextResponse.json({ error: e.message, ineligible: e.ineligible }, { status: e.status });
    const message = e instanceof TxError ? e.message : "Couldn't add the credential on-chain.";
    return NextResponse.json({ error: message, hash: e instanceof TxError ? e.hash : undefined }, { status: 502 });
  }
}
