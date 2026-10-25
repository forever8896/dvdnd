// Network configuration. One setting picks the network:
//   NEXT_PUBLIC_STELLAR_NETWORK=testnet (default) | mainnet
// Each network has presets; contract IDs and endpoints can be overridden with
// NEXT_PUBLIC_* variables. Mainnet has no contract defaults: deploy with
// scripts/testnet/deploy.sh (STELLAR_NETWORK=mainnet) and set the IDs.

export type NetworkName = "testnet" | "mainnet";

export const NETWORK_NAME: NetworkName = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const IS_TESTNET = NETWORK_NAME === "testnet";

const PRESETS = {
  testnet: {
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org" as string | null,
    explorer: "https://stellar.expert/explorer/testnet",
    /** Circle's testnet USDC. */
    usdcIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    usdcSac: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    contracts: {
      registry: "CCL5K3BT7EKT47SLRIHL23AMKELXPY34WATWMRLKGW2ZWYOALE66Y2TZ",
      gate: "CBPU52XUHU4UQ3MUBOXITFNHQMOON3SDEWN2IVKPGRCZSQTRTCLGDB7N",
      offering: "CAJSMXTDKZSBM5KH745LCPF6LCPWR2CHFSTSIKD7RRBXBBBHRQJCYNOL",
      vault: "CDU5CGRWVSMFKQWRNJLP5XAKHQAF624QTLUNCONHJ4GQHOZOVAQROHKM",
    },
    /** Ledger shortly before the gate's first credential; event scans start here. */
    gateFromLedger: 5_380_900,
  },
  mainnet: {
    passphrase: "Public Global Stellar Network ; September 2015",
    // SDF runs no public mainnet RPC; set NEXT_PUBLIC_RPC_URL to a provider.
    rpcUrl: "",
    horizonUrl: "https://horizon.stellar.org",
    friendbotUrl: null,
    explorer: "https://stellar.expert/explorer/public",
    /** Circle's mainnet USDC. */
    usdcIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    usdcSac: "",
    contracts: { registry: "", gate: "", offering: "", vault: "" },
    gateFromLedger: 0,
  },
};

const P = PRESETS[NETWORK_NAME];

export const NETWORK = {
  name: NETWORK_NAME,
  passphrase: P.passphrase,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || P.rpcUrl,
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL || P.horizonUrl,
  friendbotUrl: P.friendbotUrl,
  explorer: P.explorer,
  gateFromLedger: Number(process.env.NEXT_PUBLIC_GATE_FROM_LEDGER) || P.gateFromLedger,
};

/** Domain serving /.well-known/stellar.toml; set as each share-token issuer's home_domain. */
export const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "dvdnd.vercel.app";

export const CONTRACTS = {
  registry: process.env.NEXT_PUBLIC_REGISTRY || P.contracts.registry,
  gate: process.env.NEXT_PUBLIC_GATE || P.contracts.gate,
  offering: process.env.NEXT_PUBLIC_OFFERING || P.contracts.offering,
  vault: process.env.NEXT_PUBLIC_VAULT || P.contracts.vault,
  usdc: process.env.NEXT_PUBLIC_USDC_SAC || P.usdcSac,
};

export const USDC_ISSUER = P.usdcIssuer;

/** Settings still missing before the app can run on this network. */
export const MISSING_CONFIG = [
  ...(NETWORK.rpcUrl ? [] : ["NEXT_PUBLIC_RPC_URL"]),
  ...Object.entries(CONTRACTS)
    .filter(([, v]) => !v)
    .map(([k]) => (k === "usdc" ? "NEXT_PUBLIC_USDC_SAC" : `NEXT_PUBLIC_${k.toUpperCase()}`)),
];

/** Share tokens and USDC both use 7 decimals. */
export const DECIMALS = 7;
export const UNIT = 10_000_000n;

/** Nullifier scope pinned in the gate contract. */
export const PLATFORM_SCOPE = 1n;

/** idOS, the reusable KYC network: its relay runs the identity check and its
 *  nodes hold the resulting credential, which the investor shares with us. */
export const IDOS = {
  nodeUrl: process.env.NEXT_PUBLIC_IDOS_NETWORK_URL ?? "",
  relayUrl: process.env.NEXT_PUBLIC_IDOS_RELAY_URL ?? "",
  enclaveUrl: process.env.NEXT_PUBLIC_IDOS_ENCLAVE_URL || "https://enclave.idos.network",
  acceptedIssuerPublicKey: process.env.NEXT_PUBLIC_IDOS_ACCEPTED_ISSUER_PUBLIC_KEY ?? "",
  acceptedIssuerId: process.env.NEXT_PUBLIC_IDOS_ACCEPTED_ISSUER_ID ?? "",
  /** Our consumer's ed25519 public key (hex): grants name it as the grantee. */
  consumerAuthPublicKey: process.env.NEXT_PUBLIC_IDOS_CONSUMER_PUBLIC_IDENTIFIER ?? "",
  /** Our consumer's encryption public key (base64): shared copies are encrypted to it. */
  consumerEncryptionPublicKey: process.env.NEXT_PUBLIC_IDOS_CONSUMER_ENCRYPTION_PUBLIC_KEY ?? "",
};
export const IDOS_ENABLED = Boolean(
  IDOS.nodeUrl && IDOS.relayUrl && IDOS.acceptedIssuerPublicKey && IDOS.consumerAuthPublicKey && IDOS.consumerEncryptionPublicKey,
);
