// Issues a dvdnd credential from an idOS KYC credential the investor shared
// with us: reads and verifies it, takes the verified residence country, and
// adds Poseidon(country, expiry, commitment) to the gate's tree. One per idOS
// identity. The response carries the country so the browser can rebuild the leaf.

import { NextResponse } from "next/server";
import { verifiedResidence } from "@/lib/idos-server";
import { issueCredential, IssueError, parseCommitment } from "@/lib/issuer";
import { TxError } from "@/lib/stellar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { userId?: string; commitment?: string };
  try {
    if (!body.userId || !UUID.test(body.userId)) throw new IssueError("Invalid idOS user.", 400);
    const commitment = parseCommitment(body.commitment);
    const residence = await verifiedResidence(body.userId);
    const issued = await issueCredential(residence.country, commitment, body.userId);
    return NextResponse.json({ ...issued, basis: residence.basis });
  } catch (e) {
    if (e instanceof IssueError) return NextResponse.json({ error: e.message, ineligible: e.ineligible }, { status: e.status });
    if (e instanceof TxError) return NextResponse.json({ error: e.message, hash: e.hash }, { status: 502 });
    console.error("idos credential", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read your idOS credential." }, { status: 502 });
  }
}
