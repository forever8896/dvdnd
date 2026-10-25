// Everything one investor holds across dvdnd, read from the contracts.

import {
  contribution,
  fromUnits,
  listListings,
  pool,
  position,
  RaiseState,
  sc,
  tokenBalance,
  type Listing,
  type Pool,
  type Position,
} from "./chain";
import { shareAsset } from "./compliance";
import { NETWORK } from "./config";
import { read } from "./stellar";

export type Holding = {
  listing: Listing;
  /** Tokens in the wallet (unlocked), including any held for open sell orders. */
  wallet: number;
  /** Wallet tokens reserved by open sell orders on the order book; they can't be locked or moved. */
  inOrders: number;
  /** Tokens earning this period. */
  locked: number;
  /** Tokens locked this period, earning from the next one. */
  pending: number;
  /** USDC dividends ready to claim. */
  claimable: number;
  /** The wallet's share-token trustline is frozen (lock-up, or compliance). */
  frozen: boolean;
  pool: Pool;
  position: Position;
};

export type EscrowEntry = { listing: Listing; amount: number };

export type Portfolio = {
  holdings: Holding[];
  escrow: EscrowEntry[];
  totals: { tokensValue: number; escrow: number; claimable: number; locked: number };
};

/** Selling liabilities per asset ("CODE:ISSUER"): tokens reserved by open sell orders. */
async function reserved(account: string): Promise<Map<string, number>> {
  const res = await fetch(`${NETWORK.horizonUrl}/accounts/${account}`).catch(() => null);
  if (!res?.ok) return new Map();
  const a = (await res.json()) as { balances: { asset_code?: string; asset_issuer?: string; selling_liabilities?: string }[] };
  return new Map(a.balances.filter((b) => b.asset_code && Number(b.selling_liabilities) > 0).map((b) => [`${b.asset_code}:${b.asset_issuer}`, Number(b.selling_liabilities)]));
}

export async function loadPortfolio(investor: string): Promise<Portfolio> {
  const [listings, inOrders] = await Promise.all([listListings(), reserved(investor)]);
  const rows = await Promise.all(
    listings.map(async (listing) => {
      const [escrowed, wallet, pos, pl, authorized] = await Promise.all([
        contribution(listing.raise.id, investor),
        // No trustline yet means no balance.
        tokenBalance(listing.raise.token, investor).catch(() => 0n),
        position(listing.raise.token, investor),
        pool(listing.raise.token),
        read<boolean>(listing.raise.token, "authorized", [sc.address(investor)]).catch(() => true),
      ]);
      // Only look the asset up when some order holds tokens back.
      const asset = inOrders.size && wallet > 0n ? await shareAsset(listing.raise.token) : null;
      const held = asset ? (inOrders.get(`${asset.code}:${asset.issuer}`) ?? 0) : 0;
      return { listing, escrowed, wallet, pos, pl, authorized, held };
    }),
  );

  const holdings: Holding[] = [];
  const escrow: EscrowEntry[] = [];
  for (const { listing, escrowed, wallet, pos, pl, authorized, held } of rows) {
    if (escrowed > 0n) escrow.push({ listing, amount: fromUnits(escrowed) });
    if (listing.raise.state === RaiseState.Succeeded && (wallet > 0n || pos.active > 0n || pos.pending > 0n || pos.owed > 0n)) {
      holdings.push({
        listing,
        wallet: fromUnits(wallet),
        inOrders: held,
        locked: fromUnits(pos.active),
        pending: fromUnits(pos.pending),
        claimable: fromUnits(pos.owed),
        frozen: !authorized,
        pool: pl,
        position: pos,
      });
    }
  }

  const price = (h: Holding) => fromUnits(h.listing.raise.price);
  return {
    holdings,
    escrow,
    totals: {
      tokensValue: holdings.reduce((s, h) => s + (h.wallet + h.locked + h.pending) * price(h), 0),
      escrow: escrow.reduce((s, e) => s + e.amount, 0),
      claimable: holdings.reduce((s, h) => s + h.claimable, 0),
      locked: holdings.reduce((s, h) => s + h.locked + h.pending, 0),
    },
  };
}
