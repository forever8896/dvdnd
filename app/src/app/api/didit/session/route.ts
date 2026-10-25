// Starts a Didit verification for the investor's Stellar address and returns
// the hosted URL. Didit sends the investor back to /verify when done.

import { NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { createSession } from "@/lib/didit";
import { IssueError } from "@/lib/issuer";

export async function POST(req: Request) {
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  if (!address || !StrKey.isValidEd25519PublicKey(address)) {
    return NextResponse.json({ error: "Invalid Stellar address." }, { status: 400 });
  }
  try {
    const callback = `${new URL(req.url).origin}/verify?provider=didit`;
    return NextResponse.json(await createSession(address, callback));
  } catch (e) {
    const status = e instanceof IssueError ? e.status : 502;
    return NextResponse.json({ error: e instanceof IssueError ? e.message : "Couldn't start the Didit check." }, { status });
  }
}
