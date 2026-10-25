// Issues a dvdnd credential from an approved Didit verification: reads the
// decision from Didit (never trusting the browser), checks it belongs to this
// wallet, takes the verified residence country, and adds
// Poseidon(country, expiry, commitment) to the gate. One per ID document.

import { NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { getDecision, residenceFromDecision } from "@/lib/didit";
import { issueCredential, IssueError, parseCommitment } from "@/lib/issuer";
import { TxError } from "@/lib/stellar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string; address?: string; commitment?: string };
  try {
    if (!body.sessionId || !UUID.test(body.sessionId)) throw new IssueError("Invalid Didit session.", 400);
    if (!body.address || !StrKey.isValidEd25519PublicKey(body.address)) throw new IssueError("Invalid Stellar address.", 400);
    const commitment = parseCommitment(body.commitment);
    const residence = residenceFromDecision(await getDecision(body.sessionId), body.address);
    const issued = await issueCredential(residence.country, commitment, { source: "didit", id: residence.documentId });
    return NextResponse.json({ ...issued, basis: residence.basis });
  } catch (e) {
    if (e instanceof IssueError) return NextResponse.json({ error: e.message, ineligible: e.ineligible, us: e.us }, { status: e.status });
    if (e instanceof TxError) return NextResponse.json({ error: e.message, hash: e.hash }, { status: 502 });
    console.error("didit credential", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read your Didit verification." }, { status: 502 });
  }
}
