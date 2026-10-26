// Company lookup for onboarding: searches public business registries by name.
// GET /api/registry?q=<name>[&country=<ISO numeric>]

import { NextResponse } from "next/server";
import { searchRegistries } from "@/lib/registries";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const country = Number(url.searchParams.get("country")) || undefined;
  if (q.length < 2) return NextResponse.json({ results: [], failed: [] });
  return NextResponse.json(await searchRegistries(q, country), { headers: { "cache-control": "public, max-age=300" } });
}
