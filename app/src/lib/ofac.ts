// Wallet sanctions screening against OFAC's SDN list (server only). The list
// names crypto addresses in its remarks ("Digital Currency Address - XBT
// 1Abc…"); we collect every one of them, whatever the currency, so a Stellar
// account (or a Stellar USDC/USDT holder) listed under any tag is caught.
// Name screening of people is a separate check (an identity provider's AML).

import "server-only";

const SDN_CSV = "https://www.treasury.gov/ofac/downloads/sdn.csv";
const TTL_MS = 24 * 60 * 60 * 1000;

let cache: { addresses: Set<string>; fetchedAt: number } | null = null;

/** Every crypto address in an SDN CSV, upper-cased (Stellar keys are upper-case base32). */
export function parseSdn(csv: string): Set<string> {
  const out = new Set<string>();
  for (const m of csv.matchAll(/Digital Currency Address - [A-Z0-9]+ ([A-Za-z0-9]+)/g)) out.add(m[1]!.toUpperCase());
  return out;
}

async function sanctionedAddresses(): Promise<Set<string>> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.addresses;
  try {
    const res = await fetch(SDN_CSV, { cache: "no-store" });
    if (!res.ok) throw new Error(`OFAC list: ${res.status}`);
    cache = { addresses: parseSdn(await res.text()), fetchedAt: Date.now() };
  } catch (e) {
    // A day-old list beats none; with no list at all, screening fails closed.
    if (!cache) throw e;
  }
  return cache.addresses;
}

/** Whether OFAC lists this address. Throws if the list can't be loaded (fail closed). */
export async function isSanctioned(address: string): Promise<boolean> {
  return (await sanctionedAddresses()).has(address.trim().toUpperCase());
}
