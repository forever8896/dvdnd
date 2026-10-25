// Deletes the investor's Didit session once their proof is registered on
// Stellar: the session must belong to this wallet, and the gate contract must
// show the wallet as eligible. After this, dvdnd's only record of the check is
// the credential leaf and a hash of the ID document (to stop reuse).

import { NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { eligibleUntil } from "@/lib/chain";
import { eraseSession, getDecision } from "@/lib/didit";
import { IssueError } from "@/lib/issuer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string; address?: string };
  try {
    if (!body.sessionId || !UUID.test(body.sessionId)) throw new IssueError("Invalid Didit session.", 400);
    if (!body.address || !StrKey.isValidEd25519PublicKey(body.address)) throw new IssueError("Invalid Stellar address.", 400);
    const decision = await getDecision(body.sessionId);
    if (!decision) return NextResponse.json({ erased: true, already: true });
    if (decision.vendor_data !== body.address) throw new IssueError("This verification belongs to a different wallet.", 403);
    if ((await eligibleUntil(body.address)) <= Date.now() / 1000) {
      throw new IssueError("Register your proof on Stellar first.", 409);
    }
    await eraseSession(body.sessionId);
    return NextResponse.json({ erased: true });
  } catch (e) {
    const status = e instanceof IssueError ? e.status : 502;
    return NextResponse.json({ error: e instanceof IssueError ? e.message : "Couldn't delete the Didit session." }, { status });
  }
}
