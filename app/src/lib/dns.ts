// Domain-control check for company verification: the company publishes a DNS
// TXT record that binds its domain to its dvdnd registration and wallet, and
// the server looks it up over DNS-over-HTTPS.

const RESOLVERS = ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"];
const TXT = 16;

/** The TXT record value a company must publish. */
export function expectedRecord(companyId: number, owner: string) {
  return `dvdnd-verify=${companyId}:${owner}`;
}

/** Hostname from whatever the company typed as its website, or null if it isn't a public domain. */
export function normalizeDomain(input: string | undefined | null): string | null {
  if (!input) return null;
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  host = host.replace(/^www\./, "");
  const label = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
  if (!new RegExp(`^(?:${label}\\.)+[a-z]{2,63}$`).test(host)) return null;
  return host;
}

/** Names checked, most specific first. */
export function recordNames(domain: string) {
  return [`_dvdnd.${domain}`, domain];
}

/** TXT strings for `name`. A record split into several quoted chunks is joined. */
export async function lookupTxt(name: string, fetchFn: typeof fetch = fetch): Promise<string[]> {
  let lastError: unknown;
  for (const resolver of RESOLVERS) {
    try {
      const res = await fetchFn(`${resolver}?name=${encodeURIComponent(name)}&type=TXT`, {
        headers: { accept: "application/dns-json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${resolver} answered ${res.status}`);
      const body = (await res.json()) as { Status: number; Answer?: { type: number; data: string }[] };
      // Status 3 is NXDOMAIN: the name doesn't exist, so there are no records.
      if (body.Status !== 0 && body.Status !== 3) throw new Error(`DNS status ${body.Status}`);
      return (body.Answer ?? []).filter((a) => a.type === TXT).map((a) => joinTxt(a.data));
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`Couldn't look up DNS records for ${name}: ${String(lastError)}`);
}

function joinTxt(data: string) {
  const chunks = data.match(/"((?:[^"\\]|\\.)*)"/g);
  return chunks ? chunks.map((c) => c.slice(1, -1).replace(/\\(.)/g, "$1")).join("") : data;
}

export type DomainCheck = {
  domain: string;
  expected: string;
  verified: boolean;
  /** Where the record was found, when verified. */
  foundAt?: string;
  /** dvdnd-verify records seen, to help debug a typo. */
  seen: string[];
};

export async function checkDomain(
  domain: string,
  companyId: number,
  owner: string,
  fetchFn: typeof fetch = fetch,
): Promise<DomainCheck> {
  const expected = expectedRecord(companyId, owner);
  const seen: string[] = [];
  for (const name of recordNames(domain)) {
    const records = await lookupTxt(name, fetchFn);
    if (records.some((r) => r.trim() === expected)) return { domain, expected, verified: true, foundAt: name, seen };
    seen.push(...records.filter((r) => r.startsWith("dvdnd-verify=")).map((r) => `${name}: ${r}`));
  }
  return { domain, expected, verified: false, seen };
}
