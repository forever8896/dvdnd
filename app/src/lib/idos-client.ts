"use client";

// idOS in the browser: checks whether a wallet has an idOS profile, logs the
// wallet in (it signs idOS's login message), finds the KYC credential from
// the accepted issuer and shares a copy with dvdnd. The credential is
// decrypted and re-encrypted to our consumer key inside idOS's enclave iframe,
// so this page never sees its contents.

import { Buffer } from "buffer";
import { StrKey } from "@stellar/stellar-sdk";
import type { idOSClientIdle, idOSClientLoggedIn } from "@idos-network/client";
import { IDOS } from "./config";
import type { Signer } from "./stellar";

/** Where the idOS enclave iframe mounts; the verify page renders this element. */
export const ENCLAVE_CONTAINER = "idOS-enclave";

let idle: Promise<idOSClientIdle> | null = null;

function client() {
  if (!idle) {
    idle = import("@idos-network/client").then(({ createIDOSClient }) =>
      createIDOSClient({
        nodeUrl: IDOS.nodeUrl,
        enclaveOptions: { container: `#${ENCLAVE_CONTAINER}`, url: IDOS.enclaveUrl },
      }).createClient(),
    );
    idle.catch(() => (idle = null));
  }
  return idle;
}

export async function hasProfile(address: string) {
  return (await client()).addressHasProfile(address);
}

/**
 * Logs the wallet in to idOS. idOS stores Stellar wallets by G-address and
 * authenticates them by ed25519 signature over the raw public key, so the
 * signer is identified by the key (hex) and the profile looked up by address.
 */
export async function logIn(signer: Signer): Promise<idOSClientLoggedIn> {
  const { idOSClientWithUserSigner } = await import("@idos-network/client");
  const base = await client();
  const publicKeyHex = Buffer.from(StrKey.decodeEd25519PublicKey(signer.publicKey)).toString("hex");
  const wallet = {
    publicAddress: publicKeyHex,
    publicKey: publicKeyHex,
    signatureType: "ed25519",
    walletType: "Stellar",
    signMessage: signer.signMessage,
  };
  const withKey = await base.withUserSigner(wallet as unknown as Parameters<idOSClientIdle["withUserSigner"]>[0]);
  const withAddress = new idOSClientWithUserSigner(
    base,
    withKey.signer,
    withKey.kwilSigner,
    signer.publicKey,
    publicKeyHex,
    "Stellar",
  );
  return withAddress.logIn();
}

const sameKey = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Shares the user's KYC credential with dvdnd unless a share already exists. */
export async function shareKycCredential(user: idOSClientLoggedIn): Promise<"shared" | "already-shared"> {
  const grants = await user.getAccessGrantsOwned();
  if (grants.some((g) => sameKey(g.ag_grantee_wallet_identifier, IDOS.consumerAuthPublicKey))) return "already-shared";

  const credentials = await user.filterCredentials({
    acceptedIssuers: [IDOS.acceptedIssuerId, IDOS.acceptedIssuerPublicKey].filter(Boolean).map((authPublicKey) => ({ authPublicKey })),
  });
  if (!credentials.length) throw new Error("Your idOS profile has no KYC credential from the accepted issuer yet.");
  await user.requestAccessGrant(credentials[0]!.id, {
    consumerEncryptionPublicKey: IDOS.consumerEncryptionPublicKey,
    consumerAuthPublicKey: IDOS.consumerAuthPublicKey,
  });
  return "shared";
}
