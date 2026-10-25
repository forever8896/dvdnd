// Returns a link to the idOS relay's identity check, locked to the investor's
// EVM wallet (the relay logs in EVM wallets only).

import { NextResponse } from "next/server";
import { getAddress, isAddress } from "ethers";
import { kycLink } from "@/lib/idos-server";
import { IssueError } from "@/lib/issuer";

export async function POST(req: Request) {
  const { evmAddress } = (await req.json().catch(() => ({}))) as { evmAddress?: string };
  if (!evmAddress || !isAddress(evmAddress)) {
    return NextResponse.json({ error: "Invalid Ethereum address." }, { status: 400 });
  }
  try {
    return NextResponse.json({ link: kycLink(getAddress(evmAddress)) });
  } catch (e) {
    const status = e instanceof IssueError ? e.status : 500;
    return NextResponse.json({ error: e instanceof IssueError ? e.message : "Couldn't start the identity check." }, { status });
  }
}
