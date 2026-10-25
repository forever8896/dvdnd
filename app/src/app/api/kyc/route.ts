// Mock KYC issuer. In production a KYC vendor checks the investor's documents
// and residence; here we accept the declared residence, refuse US and
// sanctioned countries, and add the investor's credential leaf to the gate's
// on-chain Merkle tree with the platform's issuer key.
//
// The browser only sends the leaf, a Poseidon hash of (country, expiry,
// secret). The secret stays in the browser, so the issuer can't prove on the
// investor's behalf. A production issuer would also bind the leaf to the
// verified residence (e.g. by signing it) instead of trusting the declaration.

import { NextResponse } from "next/server";
import { CONTRACTS } from "@/lib/config";
import { sc } from "@/lib/chain";
import { invoke, Keypair, keypairSigner, TxError } from "@/lib/stellar";
import { BLOCKED_COUNTRIES, FR_MODULUS } from "@/lib/zk";

export async function POST(req: Request) {
  const secret = process.env.DVDND_ADMIN_SECRET;
  if (!secret) return NextResponse.json({ error: "KYC issuer is not configured." }, { status: 500 });

  let body: { leaf?: string; country?: number; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { leaf, country, fullName } = body;
  if (!fullName?.trim()) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (typeof country !== "number" || !Number.isInteger(country)) {
    return NextResponse.json({ error: "Choose your country of residence." }, { status: 400 });
  }
  if (BLOCKED_COUNTRIES.includes(country)) {
    return NextResponse.json(
      { error: "dvdnd isn't available to residents of this country.", ineligible: true },
      { status: 403 },
    );
  }
  let leafValue: bigint;
  try {
    leafValue = BigInt(leaf ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid credential." }, { status: 400 });
  }
  if (leafValue <= 0n || leafValue >= FR_MODULUS) {
    return NextResponse.json({ error: "Invalid credential." }, { status: 400 });
  }

  try {
    const issuer = keypairSigner(Keypair.fromSecret(secret));
    const res = await invoke(issuer, CONTRACTS.gate, "add_credential", [sc.u256(leafValue)]);
    return NextResponse.json({ index: Number(res.returnValue), hash: res.hash });
  } catch (e) {
    const message = e instanceof TxError ? e.message : "Couldn't add the credential on-chain.";
    return NextResponse.json({ error: message, hash: e instanceof TxError ? e.hash : undefined }, { status: 502 });
  }
}
