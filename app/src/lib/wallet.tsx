"use client";

// Built-in testnet wallet: a keypair kept in this browser and funded by
// Friendbot, so the whole flow is clickable without installing anything.
// Investors and companies get separate accounts, matching the split sign-in.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { accountExists, balances, friendbot, Keypair, keypairSigner, type Balances, type Signer } from "./stellar";
import { eligibleUntil } from "./chain";

export type Role = "investor" | "company";

type WalletState = {
  ready: boolean;
  signer: Record<Role, Signer | null>;
  balances: Record<Role, Balances | null>;
  /** Unix seconds until which the investor is eligible (0 = not verified). */
  eligibleUntil: number;
  create: (role: Role) => Promise<Signer>;
  refresh: () => Promise<void>;
  forget: (role: Role) => void;
};

const WalletContext = createContext<WalletState | null>(null);
const storageKey = (role: Role) => `dvdnd.wallet.${role}`;

function loadKeypair(role: Role): Keypair | null {
  try {
    const secret = localStorage.getItem(storageKey(role));
    return secret ? Keypair.fromSecret(secret) : null;
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [keys, setKeys] = useState<Record<Role, Keypair | null>>({ investor: null, company: null });
  const [bals, setBals] = useState<Record<Role, Balances | null>>({ investor: null, company: null });
  const [eligible, setEligible] = useState(0);

  useEffect(() => {
    setKeys({ investor: loadKeypair("investor"), company: loadKeypair("company") });
    setReady(true);
  }, []);

  const signer = useMemo(
    () => ({
      investor: keys.investor ? keypairSigner(keys.investor) : null,
      company: keys.company ? keypairSigner(keys.company) : null,
    }),
    [keys],
  );

  const refresh = useCallback(async () => {
    const [inv, com] = await Promise.all([
      keys.investor ? balances(keys.investor.publicKey()) : null,
      keys.company ? balances(keys.company.publicKey()) : null,
    ]);
    setBals({ investor: inv, company: com });
    if (keys.investor) {
      try {
        setEligible(await eligibleUntil(keys.investor.publicKey()));
      } catch {
        setEligible(0);
      }
    }
  }, [keys]);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const create = useCallback(async (role: Role) => {
    const kp = loadKeypair(role) ?? Keypair.random();
    if (!(await accountExists(kp.publicKey()))) await friendbot(kp.publicKey());
    try {
      localStorage.setItem(storageKey(role), kp.secret());
    } catch {
      /* private window: the wallet lives for this session only */
    }
    setKeys((k) => ({ ...k, [role]: kp }));
    return keypairSigner(kp);
  }, []);

  const forget = useCallback((role: Role) => {
    try {
      localStorage.removeItem(storageKey(role));
    } catch {
      /* ignore */
    }
    setKeys((k) => ({ ...k, [role]: null }));
    setBals((b) => ({ ...b, [role]: null }));
    if (role === "investor") setEligible(0);
  }, []);

  const value: WalletState = {
    ready,
    signer,
    balances: bals,
    eligibleUntil: eligible,
    create,
    refresh,
    forget,
  };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export const isEligible = (until: number) => until > Date.now() / 1000;
