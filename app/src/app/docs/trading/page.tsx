import { Aspects, Callout, Clip, DocHeader, DocPager, Fn } from "@/components/docs";

export const metadata = { title: "Trading between holders" };

export default function Trading() {
  return (
    <>
      <DocHeader slug="trading" />
      <p>
        After the lock-up, holders can sell to other eligible investors on Stellar&apos;s built-in order book (the SDEX),
        in share tokens against USDC. No separate exchange or matching engine is needed: the protocol matches orders and
        settles them atomically.
      </p>
      <Clip name="trade" caption="A holder places a limit order to sell 20 KESTREL at 1.15 USDC, sees it on the book, then cancels it." />
      <Aspects
        chain={
          <ul>
            <li>Share tokens are issued with <code>AUTH_REQUIRED</code>, <code>AUTH_REVOCABLE</code> and <code>AUTH_CLAWBACK_ENABLED</code>.</li>
            <li>A wallet can only hold the token once the offering has authorized it with <Fn>authorize_holder</Fn>, which checks eligibility and the holder cap.</li>
            <li>Orders are ordinary <code>manageSellOffer</code> and <code>manageBuyOffer</code> operations. A frozen wallet can&apos;t trade.</li>
          </ul>
        }
        legal={
          <ul>
            <li>Resale stays inside the eligible group: Reg S tokens don&apos;t flow back to US persons, and Reg D tokens only trade after the one-year hold.</li>
            <li>The holder cap applies to secondary buyers too, keeping the token under the §12(g) trigger.</li>
          </ul>
        }
      />
      <Callout title="Enforced everywhere, not just in this app">
        Because the restriction is on the asset itself, it holds on any wallet or exchange that uses Stellar&apos;s order
        book or path payments. An unauthorized account&apos;s order is rejected by the network.
      </Callout>
      <DocPager slug="trading" />
    </>
  );
}
