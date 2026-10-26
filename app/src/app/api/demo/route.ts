// Demo personas for the testnet persona switcher (see
// scripts/testnet/demo-personas.mts). GET lists them; POST hands out one
// persona's testnet key so the browser can sign as it. Testnet only: these
// wallets hold nothing but test funds, and anyone using the demo shares them.

import { NextResponse } from "next/server";
import { IS_TESTNET } from "@/lib/config";
import { Keypair } from "@/lib/stellar";

type Persona = { id: string; role: "company" | "investor"; name: string; blurb: string; secret: string };

function personas(): Persona[] {
  if (!IS_TESTNET) return [];
  try {
    return JSON.parse(process.env.DEMO_PERSONAS ?? "[]") as Persona[];
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json(personas().map(({ secret, ...p }) => ({ ...p, publicKey: Keypair.fromSecret(secret).publicKey() })));
}

export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const p = personas().find((x) => x.id === id);
  if (!p) return NextResponse.json({ error: "No such demo persona." }, { status: 404 });
  return NextResponse.json({ role: p.role, secret: p.secret });
}
