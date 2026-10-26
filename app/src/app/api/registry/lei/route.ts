// The LEI of a company found in a national registry, from GLEIF.
// GET /api/registry/lei?id=<registry number>&country=<ISO numeric>

import { NextResponse } from "next/server";
import { leiFor } from "@/lib/registries";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim().slice(0, 40);
  const country = Number(url.searchParams.get("country"));
  if (!id || !country) return NextResponse.json({ lei: null });
  try {
    return NextResponse.json({ lei: await leiFor(id, country) });
  } catch {
    return NextResponse.json({ lei: null });
  }
}
