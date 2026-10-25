"use client";

// idOS in the browser. The investor's idOS identity lives on an Ethereum
// wallet (MetaMask or similar), because the idOS relay that runs the KYC check
// only logs in EVM wallets. Their Stellar wallet stays separate: the ZK
// credential is a secret in this browser, not tied to either address.
//
// Here: connect the EVM wallet, check for an idOS profile, log in, find the
// KYC credential from the accepted issuer and share a copy with dvdnd. The
// credential is decrypted and re-encrypted to our consumer key inside idOS's
// enclave iframe, so this page never sees its contents.

import type { idOSClientIdle, idOSClientLoggedIn } from "@idos-network/client";
import type { Eip1193Provider, JsonRpcSigner } from "ethers";
import { IDOS } from "./config";

/** Where the idOS enclave iframe mounts; the verify page renders this element. */
export const ENCLAVE_CONTAINER = "idOS-enclave";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

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

export const hasEthereumWallet = () => typeof window !== "undefined" && Boolean(window.ethereum);

export type EvmWallet = { address: string; signer: JsonRpcSigner };

/** Asks the browser's Ethereum wallet for an account. */
export async function connectEthereum(): Promise<EvmWallet> {
  if (!window.ethereum) throw new Error("No Ethereum wallet found. Install MetaMask (or another EVM wallet) for the idOS check.");
  const { BrowserProvider } = await import("ethers");
  const signer = await new BrowserProvider(window.ethereum).getSigner();
  return { address: await signer.getAddress(), signer };
}

export async function hasProfile(address: string) {
  return (await client()).addressHasProfile(address);
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Logs the EVM wallet in to idOS (it signs idOS's login message). The wallet
 * must still be on the account that holds the idOS identity, and every
 * signature is checked against it before it reaches idOS: with two wallet
 * extensions installed, or after an account switch, a different account can
 * end up signing, which idOS only reports as "verify signature failed".
 */
export async function logIn(identity: string): Promise<idOSClientLoggedIn> {
  const { verifyMessage } = await import("ethers");
  const wallet = await connectEthereum();
  if (wallet.address.toLowerCase() !== identity.toLowerCase()) {
    throw new Error(`Your Ethereum wallet is now on ${short(wallet.address)}. Switch it back to ${short(identity)}, the account you used for the idOS check, and try again.`);
  }
  const signer = wallet.signer;
  const sign = signer.signMessage.bind(signer);
  signer.signMessage = async (message) => {
    const signature = await sign(message);
    const signedBy = verifyMessage(message, signature);
    if (signedBy.toLowerCase() !== identity.toLowerCase()) {
      throw new Error(
        `The signature came from ${short(signedBy)}, not ${short(identity)}. If you have more than one Ethereum wallet extension (e.g. MetaMask and Rabby, Phantom or Coinbase), turn off all but one, or switch the wallet to ${short(identity)}, then try again.`,
      );
    }
    return signature;
  };
  const withSigner = await (await client()).withUserSigner(signer);
  return withSigner.logIn();
}

const sameKey = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Shares the user's KYC credential with dvdnd unless a share already exists. */
export async function shareKycCredential(user: idOSClientLoggedIn): Promise<"shared" | "already-shared"> {
  const grants = await user.getAccessGrantsOwned();
  if (grants.some((g) => sameKey(g.ag_grantee_wallet_identifier, IDOS.consumerAuthPublicKey))) return "already-shared";

  const credentials = await user.filterCredentials({
    acceptedIssuers: [IDOS.acceptedIssuerId, IDOS.acceptedIssuerPublicKey].filter(Boolean).map((authPublicKey) => ({ authPublicKey })),
  });
  if (!credentials.length) throw new Error("Your idOS profile has no KYC credential from the accepted issuer yet. Finish the identity check first.");
  await user.requestAccessGrant(credentials[0]!.id, {
    consumerEncryptionPublicKey: IDOS.consumerEncryptionPublicKey,
    consumerAuthPublicKey: IDOS.consumerAuthPublicKey,
  });
  return "shared";
}
