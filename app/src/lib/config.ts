// Testnet deployment. IDs come from deployments/testnet.env and can be
// overridden with NEXT_PUBLIC_* environment variables.

export const NETWORK = {
  passphrase: "Test SDF Network ; September 2015",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org",
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  friendbotUrl: "https://friendbot.stellar.org",
  explorer: "https://stellar.expert/explorer/testnet",
};

/** Domain serving /.well-known/stellar.toml; set as each share-token issuer's home_domain. */
export const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "dvdnd.vercel.app";

export const CONTRACTS = {
  registry: process.env.NEXT_PUBLIC_REGISTRY ?? "CDWUC63EYRCEVQISAN7MZNAAOMT76VW6PTSVIUXTX3PDPXWJBNWJFJXY",
  gate: process.env.NEXT_PUBLIC_GATE ?? "CBPU52XUHU4UQ3MUBOXITFNHQMOON3SDEWN2IVKPGRCZSQTRTCLGDB7N",
  offering: process.env.NEXT_PUBLIC_OFFERING ?? "CB5EJPS7K33FE3IGEFW6VINJD5MBL3HJ32I2JOAN34AMICBW73MZED3L",
  vault: process.env.NEXT_PUBLIC_VAULT ?? "CCTY5CZFMXTBH4EPWKFHRVWDEHOFVEEWE3EPOGJEPKR65AJIG5CFLWX4",
  usdc: process.env.NEXT_PUBLIC_USDC_SAC ?? "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
};

/** Circle's testnet USDC. */
export const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

/** Share tokens and USDC both use 7 decimals. */
export const DECIMALS = 7;
export const UNIT = 10_000_000n;

/** Nullifier scope pinned in the gate contract. */
export const PLATFORM_SCOPE = 1n;
