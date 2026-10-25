"use client";

// Wallets per role (investor / company). Each role is either:
//  - an external wallet (Freighter, xBull, Lobstr, ...) through Stellar
//    Wallets Kit: we store only its address and which wallet to reconnect,
//    and every transaction is approved in the wallet; or
//  - a testnet demo wallet: a keypair kept in this browser's localStorage,
//    funded by Friendbot, so judges can click through with nothing to
//    install. It is only as safe as this browser profile, so it can be
//    exported and imported, and must never hold real funds.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { eligibleUntil } from "./chain";
import { IS_TESTNET, NETWORK } from "./config";
import { connectExternal, disconnectExternal, externalNetworkMatches, externalSigner, type ExternalWallet } from "./kit";
import { accountExists, balances, friendbot, Keypair, keypairSigner, type Balances, type Signer } from "./stellar";

export type Role = "investor" | "company";

type Stored = { kind: "demo"; secret: string } | ({ kind: "external" } & ExternalWallet);

type WalletState = {
  ready: boolean;
  signer: Record<Role, Signer | null>;
  balances: Record<Role, Balances | null>;
  /** Unix seconds until which the investor is eligible (0 = not verified). */
  eligibleUntil: number;
  /** Creates (or reuses) a testnet demo wallet in this browser. */
  create: (role: Role) => Promise<Signer>;
  /** Connects an external wallet through the wallet picker. */
  connect: (role: Role) => Promise<Signer>;
  /** Replaces the role's wallet with a demo wallet from a secret key. */
  importSecret: (role: Role, secret: string) => Promise<Signer>;
  /** The demo wallet's secret key, for backup. Null for external wallets. */
  exportSecret: (role: Role) => string | null;
  refresh: () => Promise<void>;
  forget: (role: Role) => void;
};

const WalletContext = createContext<WalletState | null>(null);
const storageKey = (role: Role) => `dvdnd.wallet.${role}`;

function load(role: Role): Stored | null {
  try {
    const raw = localStorage.getItem(storageKey(role));
    if (!raw) return null;
    // Older versions stored the bare secret key.
    if (raw.startsWith("S")) return { kind: "demo", secret: raw };
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

function save(role: Role, value: Stored | null) {
  try {
    if (value) localStorage.setItem(storageKey(role), JSON.stringify(value));
    else localStorage.removeItem(storageKey(role));
  } catch {
    /* private window: the wallet lives for this session only */
  }
}

function toSigner(s: Stored | null): Signer | null {
  if (!s) return null;
  return s.kind === "demo" ? keypairSigner(Keypair.fromSecret(s.secret)) : externalSigner(s);
}

async function ensureFunded(publicKey: string) {
  if (await accountExists(publicKey)) return;
  if (!NETWORK.friendbotUrl) throw new Error("This wallet has no XLM yet. Send it a few XLM to activate it on Stellar.");
  await friendbot(publicKey);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState<Record<Role, Stored | null>>({ investor: null, company: null });
  const [bals, setBals] = useState<Record<Role, Balances | null>>({ investor: null, company: null });
  const [eligible, setEligible] = useState(0);

  useEffect(() => {
    setStored({ investor: load("investor"), company: load("company") });
    setReady(true);
  }, []);

  const signer = useMemo(() => ({ investor: toSigner(stored.investor), company: toSigner(stored.company) }), [stored]);

  const refresh = useCallback(async () => {
    const [inv, com] = await Promise.all([
      signer.investor ? balances(signer.investor.publicKey) : null,
      signer.company ? balances(signer.company.publicKey) : null,
    ]);
    setBals({ investor: inv, company: com });
    if (signer.investor) {
      try {
        setEligible(await eligibleUntil(signer.investor.publicKey));
      } catch {
        setEligible(0);
      }
    } else setEligible(0);
  }, [signer]);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const set = useCallback((role: Role, value: Stored | null) => {
    save(role, value);
    setStored((s) => ({ ...s, [role]: value }));
    if (!value) setBals((b) => ({ ...b, [role]: null }));
  }, []);

  const create = useCallback(
    async (role: Role) => {
      if (!IS_TESTNET) throw new Error("Demo wallets exist only on testnet. Connect a Stellar wallet.");
      const existing = load(role);
      const value: Stored = existing?.kind === "demo" ? existing : { kind: "demo", secret: Keypair.random().secret() };
      const s = toSigner(value)!;
      await ensureFunded(s.publicKey);
      set(role, value);
      return s;
    },
    [set],
  );

  const connect = useCallback(
    async (role: Role) => {
      const w = await connectExternal();
      if (!(await externalNetworkMatches())) {
        const net = IS_TESTNET ? "Testnet" : "Mainnet (Public)";
        throw new Error(`${w.walletName} is not on Stellar ${net}. Switch it to ${net} and try again.`);
      }
      await ensureFunded(w.address);
      const value: Stored = { kind: "external", ...w };
      set(role, value);
      return toSigner(value)!;
    },
    [set],
  );

  const importSecret = useCallback(
    async (role: Role, secret: string) => {
      let kp: Keypair;
      try {
        kp = Keypair.fromSecret(secret.trim());
      } catch {
        throw new Error("That isn't a valid Stellar secret key (it starts with S and has 56 characters).");
      }
      await ensureFunded(kp.publicKey());
      const value: Stored = { kind: "demo", secret: kp.secret() };
      set(role, value);
      return toSigner(value)!;
    },
    [set],
  );

  const exportSecret = useCallback((role: Role) => {
    const s = stored[role];
    return s?.kind === "demo" ? s.secret : null;
  }, [stored]);

  const forget = useCallback(
    (role: Role) => {
      if (stored[role]?.kind === "external") void disconnectExternal();
      set(role, null);
    },
    [set, stored],
  );

  const value: WalletState = {
    ready,
    signer,
    balances: bals,
    eligibleUntil: eligible,
    create,
    connect,
    importSecret,
    exportSecret,
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
