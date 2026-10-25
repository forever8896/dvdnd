// Secondary trading of a share token against USDC on Stellar's order book
// (SDEX). Only accounts the offering contract authorized can hold the token,
// so the protocol itself keeps trading between eligible holders.

import { Asset, Operation } from "@stellar/stellar-sdk";
import { shareAsset } from "./compliance";
import { NETWORK } from "./config";
import { classic, USDC, type Signer } from "./stellar";

export async function shareToken(token: string) {
  const { code, issuer } = await shareAsset(token);
  return new Asset(code, issuer);
}

export type Level = { price: number; tokens: number };
export type Book = { bids: Level[]; asks: Level[] };
export type Offer = { id: string; side: "buy" | "sell"; price: number; tokens: number };
export type Trade = { at: string; price: number; tokens: number };
/** The account's standing with the share token. */
export type Standing = { status: "none" | "authorized" | "frozen"; tokens: number; usdc: number };

const assetParams = (prefix: "selling" | "buying" | "base" | "counter", a: Asset) =>
  a.isNative()
    ? `${prefix}_asset_type=native`
    : `${prefix}_asset_type=${a.code.length <= 4 ? "credit_alphanum4" : "credit_alphanum12"}&${prefix}_asset_code=${a.code}&${prefix}_asset_issuer=${a.issuer}`;

const sameAsset = (r: { asset_code?: string; asset_issuer?: string }, a: Asset) => r.asset_code === a.code && r.asset_issuer === a.issuer;

/** Asks sell the token for USDC; bids buy it with USDC (Horizon gives bid amounts in USDC). */
export async function orderBook(asset: Asset): Promise<Book> {
  const b = (await (await fetch(`${NETWORK.horizonUrl}/order_book?${assetParams("selling", asset)}&${assetParams("buying", USDC)}&limit=20`)).json()) as {
    bids: { price: string; amount: string }[];
    asks: { price: string; amount: string }[];
  };
  return {
    asks: b.asks.map((o) => ({ price: Number(o.price), tokens: Number(o.amount) })),
    bids: b.bids.map((o) => ({ price: Number(o.price), tokens: Number(o.amount) / Number(o.price) })),
  };
}

export async function recentTrades(asset: Asset): Promise<Trade[]> {
  const t = (await (await fetch(`${NETWORK.horizonUrl}/trades?${assetParams("base", asset)}&${assetParams("counter", USDC)}&order=desc&limit=10`)).json()) as {
    _embedded?: { records: { ledger_close_time: string; base_amount: string; price: { n: string; d: string } }[] };
  };
  return (t._embedded?.records ?? []).map((r) => ({ at: r.ledger_close_time, tokens: Number(r.base_amount), price: Number(r.price.n) / Number(r.price.d) }));
}

export async function standing(account: string, asset: Asset): Promise<Standing> {
  const res = await fetch(`${NETWORK.horizonUrl}/accounts/${account}`);
  if (!res.ok) return { status: "none", tokens: 0, usdc: 0 };
  type Line = { asset_code?: string; asset_issuer?: string; balance: string; selling_liabilities?: string; is_authorized?: boolean };
  const a = (await res.json()) as { balances: Line[] };
  // What's free to sell or spend: the balance less what open orders hold back.
  const free = (b?: Line) => (b ? Number(b.balance) - Number(b.selling_liabilities ?? 0) : 0);
  const line = a.balances.find((b) => sameAsset(b, asset));
  const usdc = free(a.balances.find((b) => sameAsset(b, USDC)));
  if (!line) return { status: "none", tokens: 0, usdc };
  return { status: line.is_authorized ? "authorized" : "frozen", tokens: free(line), usdc };
}

/** The account's open orders for this token. */
export async function myOffers(account: string, asset: Asset): Promise<Offer[]> {
  const o = (await (await fetch(`${NETWORK.horizonUrl}/accounts/${account}/offers?limit=50`)).json()) as {
    _embedded?: { records: { id: string; amount: string; price: string; selling: { asset_code?: string; asset_issuer?: string }; buying: { asset_code?: string; asset_issuer?: string } }[] };
  };
  return (o._embedded?.records ?? []).flatMap((r): Offer[] => {
    if (sameAsset(r.selling, asset) && sameAsset(r.buying, USDC)) return [{ id: r.id, side: "sell", price: Number(r.price), tokens: Number(r.amount) }];
    // A buy order is an offer selling USDC for the token; its price is tokens per USDC.
    if (sameAsset(r.selling, USDC) && sameAsset(r.buying, asset)) return [{ id: r.id, side: "buy", price: 1 / Number(r.price), tokens: Number(r.amount) * Number(r.price) }];
    return [];
  });
}

const amount = (n: number) => n.toFixed(7);

export function placeOrder(s: Signer, asset: Asset, side: "buy" | "sell", tokens: number, price: number) {
  return classic(s, [
    side === "sell"
      ? Operation.manageSellOffer({ selling: asset, buying: USDC, amount: amount(tokens), price: amount(price) })
      : Operation.manageBuyOffer({ selling: USDC, buying: asset, buyAmount: amount(tokens), price: amount(price) }),
  ]);
}

export function cancelOrder(s: Signer, asset: Asset, offer: Offer) {
  return classic(s, [
    offer.side === "sell"
      ? Operation.manageSellOffer({ selling: asset, buying: USDC, amount: "0", price: amount(offer.price), offerId: offer.id })
      : Operation.manageBuyOffer({ selling: USDC, buying: asset, buyAmount: "0", price: amount(offer.price), offerId: offer.id }),
  ]);
}
