import { Aspects, Callout, Clip, DocHeader, DocPager, Fn, Steps } from "@/components/docs";

export const metadata = { title: "Listing a company" };

export default function Companies() {
  return (
    <>
      <DocHeader slug="companies" />
      <p>
        A company goes from sign-up to an open raise in three steps: register, prove it owns the business, and sign
        the profit-share agreement. Then it sets the terms of its raise and pays a flat listing fee.
      </p>
      <Clip name="company-onboard" caption="A new company registers on Stellar, then gets the DNS record that proves it controls its domain." />
      <Steps
        items={[
          { title: "Register", body: <>Name, country, sector, website, last year&apos;s net profit and a description go into the <code>registry</code> contract. The status starts as Pending.</> },
          { title: "Verify ownership", body: <>The company adds a TXT record <code>dvdnd-verify=&lt;id&gt;:&lt;owner&gt;</code> to its domain; dvdnd checks it over DNS-over-HTTPS. A company with an LEI is also matched against the GLEIF registry. The evidence hash is stored and the company becomes Verified.</> },
          { title: "Sign the agreement", body: <>The owner signs the profit-share agreement: the share of profit committed and the payout schedule. Its sha256 is recorded with <Fn>sign_agreement</Fn> and the company becomes Active.</> },
          { title: "Open the raise", body: <>Target yield, maximum, minimum, deadline, the exemption, lock-up, holder cap, minimum ticket and compliance account. Publishing issues the share token with its compliance flags, hands its admin to the offering contract and pays the listing fee.</> },
        ]}
      />
      <Clip name="company-raise" caption="Setting the terms: a 15% target yield, open to both non-US residents and accredited investors, a one-year lock-up and a 50 USDC minimum ticket. The preview shows what the company receives and the fee." />

      <h2>An agreement anyone can check</h2>
      <p>
        The agreement text is generated entirely from on-chain fields: the company, the share of profit, the schedule.
        Every raise page rebuilds it, hashes it in the browser and compares the result with the hash in the registry.
      </p>
      <Clip name="agreement" caption="The Agreement tab: the signed text in plain words, matched against its hash on Stellar, with a download." />
      <Aspects
        chain={
          <ul>
            <li>Status runs Pending → Verified → Active. Only an Active company&apos;s owner can open a raise (<Fn>owner_if_active</Fn>).</li>
            <li>The share token is a classic Stellar asset whose SAC admin is the offering contract. No one can mint beyond what was sold.</li>
            <li>The listing fee is paid in USDC when the raise opens. Failed raises refund investors in full; the fee isn&apos;t refunded.</li>
          </ul>
        }
        legal={
          <ul>
            <li>The agreement is a profit-participation contract, enforceable off-chain. The hash proves which text was signed.</li>
            <li>The company, as issuer, picks its exemption and its compliance agent. dvdnd doesn&apos;t sell the securities.</li>
            <li>The council can suspend a company that turns out to be misrepresented.</li>
          </ul>
        }
      />
      <Callout title="Fixed price from a target yield">
        The raise size is the yearly dividend pool divided by the target yield. A company committing 40% of 84,000 USD
        profit at a 15% yield can raise up to 224,000 USDC at 1.00 per token.
      </Callout>
      <DocPager slug="companies" />
    </>
  );
}
