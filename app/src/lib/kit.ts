"use client";

// External Stellar wallets (Freighter, xBull, Lobstr, Albedo, Hana, ...)
// through Stellar Wallets Kit. Keys never leave the user's wallet; every
// transaction is approved there.

import { TransactionBuilder, type Transaction } from "@stellar/stellar-sdk";
import { NETWORK } from "./config";
import type { Signer } from "./stellar";

const HIDDEN_WALLETS = new Set(["metamask"]);

type Kit = typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;
let kitPromise: Promise<Kit> | null = null;

/** Loads and initialises the kit once, in the browser only. */
export function getKit(): Promise<Kit> {
  if (!kitPromise) {
    kitPromise = (async () => {
      const [{ StellarWalletsKit }, { defaultModules }, { Networks }] = await Promise.all([
        import("@creit.tech/stellar-wallets-kit/sdk"),
        import("@creit.tech/stellar-wallets-kit/modules/utils"),
        import("@creit.tech/stellar-wallets-kit/types"),
      ]);
      StellarWalletsKit.init({
        // MetaMask's Stellar connector needs multichain scopes that current MetaMask
        // releases reject ("Requested scopes are not supported"), so it is left out.
        modules: defaultModules({ filterBy: (m) => !HIDDEN_WALLETS.has(m.productId) }),
        network: Networks.TESTNET,
      });
      return StellarWalletsKit;
    })();
  }
  return kitPromise;
}

export type ExternalWallet = { address: string; walletId: string; walletName: string };

/** The kit and wallets reject with plain `{ code, message }` objects; turn them into Errors. */
export function walletError(e: unknown): Error {
  if (e instanceof Error) return e;
  const o = (e ?? {}) as { message?: unknown; error?: { message?: unknown } };
  const message = o.error?.message ?? o.message ?? (typeof e === "string" ? e : null);
  return new Error(typeof message === "string" && message ? message : "The wallet returned an unexpected error.");
}

/** True when the person closed the picker or declined in their wallet. */
export const isUserCancel = (e: unknown) =>
  /closed the modal|user (declined|rejected|denied|cancel)|rejected by the user|request rejected|cancelled/i.test(walletError(e).message);

/** Opens the kit's wallet picker and returns the chosen account. */
export async function connectExternal(): Promise<ExternalWallet> {
  const kit = await getKit();
  try {
    const { address } = await kit.authModal();
    const m = kit.selectedModule;
    return { address, walletId: m.productId, walletName: m.productName };
  } catch (e) {
    throw walletError(e);
  }
}

/** Network the external wallet is on, so we can ask the user to switch to testnet. */
export async function externalNetworkIsTestnet(): Promise<boolean> {
  try {
    const { networkPassphrase } = await (await getKit()).getNetwork();
    return networkPassphrase === NETWORK.passphrase;
  } catch {
    // Some wallets can't report their network; signing will fail loudly if it's wrong.
    return true;
  }
}

export function externalSigner(w: ExternalWallet): Signer {
  return {
    publicKey: w.address,
    kind: "external",
    label: w.walletName,
    sign: async (tx: Transaction) => {
      const kit = await getKit();
      try {
        kit.setWallet(w.walletId);
        const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), {
          networkPassphrase: NETWORK.passphrase,
          address: w.address,
        });
        return TransactionBuilder.fromXDR(signedTxXdr, NETWORK.passphrase) as Transaction;
      } catch (e) {
        const err = walletError(e);
        throw isUserCancel(err) ? new Error(`You declined the request in ${w.walletName}. Nothing was sent.`) : err;
      }
    },
  };
}

export async function disconnectExternal() {
  try {
    await (await getKit()).disconnect();
  } catch {
    /* already disconnected */
  }
}
