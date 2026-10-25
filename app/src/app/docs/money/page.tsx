import { Aspects, DocHeader, DocPager, Shot } from "@/components/docs";

export const metadata = { title: "Money in and out" };

export default function Money() {
  return (
    <>
      <DocHeader slug="money" />
      <p>
        Raises, dividends and trades all settle in USDC issued by Circle on Stellar. There are two ways to get it in
        the app.
      </p>
      <h2>Swap XLM for USDC</h2>
      <p>
        <b>Add money</b> pays test XLM through Stellar&apos;s DEX with a path payment and receives USDC in the same
        operation. It shows up inside the invest modal whenever a wallet doesn&apos;t have enough.
      </p>
      <h2>Bank transfers through an anchor</h2>
      <p>
        Anchors are regulated businesses that connect bank accounts to Stellar. The wallet page signs in to an anchor
        with SEP-10 and opens its hosted deposit or withdrawal flow with SEP-24. On testnet this is the Stellar
        Foundation&apos;s test anchor, which pays out the same Circle testnet USDC the raises use.
      </p>
      <Shot name="wallet-bank" caption="The wallet page, signed in to testanchor.stellar.org: deposit from a bank or withdraw to one." />
      <Aspects
        chain={
          <ul>
            <li>SEP-10: the wallet signs the anchor&apos;s zero-sequence challenge transaction. The app checks it came from the anchor&apos;s signing key.</li>
            <li>SEP-24: deposits arrive as a USDC payment to the wallet. For a withdrawal, the app sends USDC to the anchor with the memo it asks for.</li>
          </ul>
        }
        legal={
          <ul>
            <li>The anchor does its own KYC and holds the money transmission licences. dvdnd never touches fiat.</li>
            <li>In production the anchor is chosen per market, alongside Circle Mint for larger amounts.</li>
          </ul>
        }
      />
      <DocPager slug="money" />
    </>
  );
}
