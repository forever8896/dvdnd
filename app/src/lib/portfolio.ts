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
import { read } from "./stellar";

export type Holding = {
  listing: Listing;
  /** Tokens in the wallet (unlocked). */
  wallet: number;
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

export async function loadPortfolio(investor: string): Promise<Portfolio> {
  const listings = await listListings();
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
      return { listing, escrowed, wallet, pos, pl, authorized };
    }),
  );

  const holdings: Holding[] = [];
  const escrow: EscrowEntry[] = [];
  for (const { listing, escrowed, wallet, pos, pl, authorized } of rows) {
    if (escrowed > 0n) escrow.push({ listing, amount: fromUnits(escrowed) });
    if (listing.raise.state === RaiseState.Succeeded && (wallet > 0n || pos.active > 0n || pos.pending > 0n || pos.owed > 0n)) {
      holdings.push({
        listing,
        wallet: fromUnits(wallet),
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
