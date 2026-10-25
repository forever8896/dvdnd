// Returns a link to the idOS relay's identity check for the investor's wallet.

import { NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { kycLink } from "@/lib/idos-server";
import { IssueError } from "@/lib/issuer";

export async function POST(req: Request) {
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  if (!address || !StrKey.isValidEd25519PublicKey(address)) {
    return NextResponse.json({ error: "Invalid Stellar address." }, { status: 400 });
  }
  try {
    return NextResponse.json({ link: kycLink(address) });
  } catch (e) {
    const status = e instanceof IssueError ? e.status : 500;
    return NextResponse.json({ error: e instanceof IssueError ? e.message : "Couldn't start the identity check." }, { status });
  }
}
