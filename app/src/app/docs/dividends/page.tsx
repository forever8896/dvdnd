import { Aspects, Callout, Clip, DocHeader, DocPager, Fn, Shot } from "@/components/docs";

export const metadata = { title: "Lock-up and dividends" };

export default function Dividends() {
  return (
    <>
      <DocHeader slug="dividends" />
      <p>
        Dividends reward holders who stay. A company commits a share of its yearly net profit and pays it in USDC each
        period. The payout is split pro-rata among tokens that were locked in the vault for the whole period, so locking
        just before a payout earns nothing.
      </p>
      <Shot name="portfolio" caption="Portfolio: tokens earning in the vault, a lock-up date, unlocked tokens and tokens held by an open sell order." />

      <h2>1. Lock</h2>
      <p>
        Tokens bought during a lock-up are already in the vault. Afterwards, holders choose how much to lock. Tokens
        locked now start earning from the next period, and can be unlocked at any time.
      </p>
      <Clip name="lock" caption="Locking 250 KESTREL. They start earning when the next dividend period starts." />

      <h2>2. The company pays</h2>
      <p>
        At the end of a period the company enters its net profit; the page works out the committed share and pays it to
        the vault in one transaction, which also starts the next period.
      </p>
      <Clip name="pay-dividend" caption="Kestrel Coffee Roasters reports 50 USD of profit for the period and pays 40% of it, 20 USDC, to its 250 locked tokens." />

      <h2>3. Holders claim</h2>
      <Clip name="claim-dividend" caption="The holder claims the 20 USDC. It lands in the wallet as Circle USDC." />
      <Aspects
        chain={
          <ul>
            <li>The <code>vault</code> keeps a reward-per-token accumulator per share token, plus active and pending totals.</li>
            <li><Fn>lock</Fn> adds pending tokens. <Fn>distribute</Fn> pays the period and turns pending into active. <Fn>claim</Fn> pays out what each holder is owed.</li>
            <li>Every call costs the same however many holders there are. There is no loop over holders.</li>
          </ul>
        }
        legal={
          <ul>
            <li>The obligation to pay is in the signed profit-share agreement, enforced off-chain. The chain records every payment.</li>
            <li>Late payments are flagged on the listing.</li>
            <li>Tokens in a lock-up can&apos;t move because the wallet&apos;s trustline is deauthorized. They still earn.</li>
          </ul>
        }
      />
      <Callout title="Why full periods only">
        Paying only tokens locked for the whole period removes the incentive to buy just before a payout and sell just
        after. Holders who stay are the ones who earn.
      </Callout>
      <DocPager slug="dividends" />
    </>
  );
}
