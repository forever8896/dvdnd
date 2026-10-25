// SEP-1 stellar.toml: who runs dvdnd, the accounts it controls and every
// company share token, read live from the contracts. Wallets and explorers
// find it through each token issuer's home_domain.

import { CONTRACTS, NETWORK, SITE_DOMAIN, USDC_ISSUER } from "@/lib/config";
import { countryName, fromUnits, listListings, parseProfile, RaiseState } from "@/lib/chain";
import { read } from "@/lib/stellar";

export const revalidate = 300;

const q = (s: string) => JSON.stringify(s.replace(/[\r\n]+/g, " "));

export async function GET() {
  const listings = await listListings().catch(() => []);
  const currencies = await Promise.all(
    listings.map(async (l) => {
      // A Stellar Asset Contract's name() is "CODE:ISSUER".
      const name = await read<string>(l.raise.token, "name").catch(() => null);
      if (!name || !name.includes(":")) return null;
      const [code, issuer] = name.split(":");
      const profile = parseProfile(l.company);
      const sold = l.raise.state === RaiseState.Succeeded ? Math.round(fromUnits(l.raise.raised) / fromUnits(l.raise.price)) : null;
      return [
        "[[CURRENCIES]]",
        `code=${q(code!)}`,
        `issuer=${q(issuer!)}`,
        `status="test"`,
        `display_decimals=2`,
        `name=${q(l.company.name.slice(0, 20))}`,
        `desc=${q(`Profit-share token of ${l.company.name} (${countryName(l.company.country)}, ${profile.sector}). Holders who lock for a full period receive ${l.company.payout_bps / 100}% of the company's net profit in USDC.`)}`,
        `conditions=${q("Testnet demonstration. Only wallets that have proven residence outside the United States can hold this token (Regulation S). dvdnd can freeze holdings for compliance. Supply equals what was sold in the raise and cannot be increased.")}`,
        sold !== null ? `fixed_number=${sold}` : `is_unlimited=false`,
        `is_asset_anchored=false`,
        "",
      ].join("\n");
    }),
  );

  const body = [
    `VERSION="2.0.0"`,
    `NETWORK_PASSPHRASE=${q(NETWORK.passphrase)}`,
    "",
    "[DOCUMENTATION]",
    `ORG_NAME="dvdnd"`,
    `ORG_URL=${q(`https://${SITE_DOMAIN}`)}`,
    `ORG_DESCRIPTION=${q("Tokenized private equity on Stellar: profitable businesses raise USDC at a fixed price and pay USDC dividends to holders who lock their tokens. Testnet demonstration.")}`,
    `ORG_GITHUB="forever8896/dvdnd"`,
    "",
    "# Contracts (testnet)",
    `# registry ${CONTRACTS.registry}`,
    `# gate     ${CONTRACTS.gate}`,
    `# offering ${CONTRACTS.offering}`,
    `# vault    ${CONTRACTS.vault}`,
    `# USDC     ${USDC_ISSUER}`,
    "",
    ...currencies.filter(Boolean),
  ].join("\n");

  return new Response(body + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // SEP-1 requires CORS so wallets on other origins can read it.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
