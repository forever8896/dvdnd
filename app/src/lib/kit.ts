"use client";

// External Stellar wallets (Freighter, xBull, Lobstr, Albedo, Hana, ...)
// through Stellar Wallets Kit. Keys never leave the user's wallet; every
// transaction is approved there.

import { TransactionBuilder, type Transaction } from "@stellar/stellar-sdk";
import { NETWORK } from "./config";
import type { Signer } from "./stellar";

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
      StellarWalletsKit.init({ modules: defaultModules(), network: Networks.TESTNET });
      return StellarWalletsKit;
    })();
  }
  return kitPromise;
}

export type ExternalWallet = { address: string; walletId: string; walletName: string };

/** Opens the kit's wallet picker and returns the chosen account. */
export async function connectExternal(): Promise<ExternalWallet> {
  const kit = await getKit();
  const { address } = await kit.authModal();
  const m = kit.selectedModule;
  return { address, walletId: m.productId, walletName: m.productName };
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
      kit.setWallet(w.walletId);
      const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK.passphrase,
        address: w.address,
      });
      return TransactionBuilder.fromXDR(signedTxXdr, NETWORK.passphrase) as Transaction;
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
