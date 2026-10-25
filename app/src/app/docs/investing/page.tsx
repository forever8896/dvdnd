import { Aspects, Callout, Clip, DocHeader, DocPager, Fn, Steps } from "@/components/docs";

export const metadata = { title: "Investing in a raise" };

export default function Investing() {
  return (
    <>
      <DocHeader slug="investing" />
      <p>
        Every raise has one price, usually 1.00 USDC per token, set from the company&apos;s committed profit and a target
        yield. It has a minimum, a maximum and a deadline. Investors commit USDC to escrow; nothing reaches the company
        unless the minimum is met.
      </p>
      <Clip name="invest" caption="Commit 100 USDC to a raise: Add money swaps test XLM for Circle's testnet USDC, then one signature moves it into escrow." />
      <Steps
        items={[
          { title: "Check the terms", body: "Profit committed, target yield, the exemption, the minimum ticket, the holder cap, the lock-up date and who holds the compliance role are all on the raise page, read from the contract." },
          { title: "Commit USDC", body: <>The wallet is screened against OFAC&apos;s sanctions list, then <Fn>invest</Fn> moves USDC into the offering contract. The contract checks eligibility for the raise&apos;s exemption, the minimum ticket and the holder cap.</> },
          { title: "The raise closes", body: <>Once the raise is full or past its deadline, anyone can call <Fn>finalize</Fn>. If the minimum was reached the company receives everything raised; if not, refunds open.</> },
          { title: "Claim tokens or a refund", body: <><Fn>claim_tokens</Fn> mints exactly contribution ÷ price. It is the only way tokens are ever minted. During a lock-up they go straight into the dividend vault.</> },
        ]}
      />
      <Aspects
        chain={
          <ul>
            <li>Escrow lives in the <code>offering</code> contract. It has no admin withdrawal path.</li>
            <li>The offering is the share token&apos;s SAC admin, so it alone can mint. After the raise, supply is fixed.</li>
            <li><code>claim_tokens</code> creates the share token trustline and authorizes it in the same call.</li>
          </ul>
        }
        legal={
          <ul>
            <li>All-or-nothing protects investors from funding a business that couldn&apos;t raise what it needs.</li>
            <li>The investor confirms they are outside the US (Reg S) or signs an accreditation statement (506(c)).</li>
            <li>Expected dividends are estimates from last year&apos;s profit and aren&apos;t guaranteed.</li>
          </ul>
        }
      />

      <h2>The accredited route (506(c))</h2>
      <p>For raises that accept accredited investors, an investor can qualify in one of two ways:</p>
      <ul>
        <li><b>Verified.</b> An accreditation verifier named by the raise attests on-chain (<Fn>attest_accredited</Fn>). On testnet, dvdnd&apos;s key stands in for a verification service.</li>
        <li><b>High minimum.</b> The investor signs an accreditation statement (<Fn>self_certify</Fn>, its hash on-chain, as a person or an entity) and invests at least 200,000 USDC, or 1,000,000 USDC for an entity.</li>
      </ul>
      <Callout title="Why a raise can mix both">
        A raise marked &quot;Reg S + 506(c)&quot; accepts proven non-US residents with no minimum, and everyone else as
        accredited investors. Both groups get the same token and the same dividends, under the Reg D one-year lock-up.
      </Callout>
      <DocPager slug="investing" />
    </>
  );
}
