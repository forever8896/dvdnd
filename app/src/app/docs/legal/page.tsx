import { Aspects, Callout, DocHeader, DocPager, Pillars } from "@/components/docs";

export const metadata = { title: "Legal model" };

export default function Legal() {
  return (
    <>
      <DocHeader slug="legal" />
      <Callout title="Not legal advice" tone="warn">
        This page describes how dvdnd is designed to fit US securities rules. It is a draft strategy for a hackathon
        project, not legal advice. A real launch needs securities counsel in every market it serves.
      </Callout>

      <h2>Software, not a broker</h2>
      <p>
        A company that sells its own securities can rely on an exemption from registration. The platform it uses risks
        becoming an unregistered broker if it takes a cut of each sale, handles investors&apos; money or picks who
        invests. dvdnd&apos;s design avoids all three, following the conditions of Securities Act §4(b) for platforms
        that only host offerings:
      </p>
      <Pillars
        items={[
          { title: "No cut.", body: "A company pays a flat listing fee when it opens a raise, never a share of what it raises. The fee is set by the council and is the same for every raise." },
          { title: "No custody.", body: "Investor USDC sits in the offering contract. It can only go to the company when a raise succeeds, or back to each investor when it fails. No admin key can withdraw it." },
          { title: "No gatekeeper.", body: "Each raise names its own compliance account, the company or its transfer agent. Only that account can freeze or claw back holdings. dvdnd has no such power." },
        ]}
      />

      <h2>Exemptions, chosen per raise</h2>
      <table className="table">
        <thead>
          <tr><th>Exemption</th><th>Who can invest</th><th>How the contract checks it</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Regulation S</b></td>
            <td>People who live outside the United States</td>
            <td>A zero-knowledge proof of non-US residence, verified by the <code>gate</code> contract. See <a href="/docs/verification">Proving eligibility</a>.</td>
          </tr>
          <tr>
            <td><b>Rule 506(c)</b></td>
            <td>Accredited investors, US residents included</td>
            <td>A verifier&apos;s attestation, or a signed accreditation statement plus a minimum investment of 200,000 USDC (1,000,000 USDC for an entity).</td>
          </tr>
          <tr>
            <td><b>Both</b></td>
            <td>Either of the above, side by side</td>
            <td>Proven non-US residents invest under Reg S and everyone else as accredited investors. The stricter lock-up applies to the whole raise.</td>
          </tr>
        </tbody>
      </table>
      <p>
        The high-minimum route for 506(c) follows the SEC staff&apos;s March 2025 guidance. A large enough minimum
        investment, together with the investor&apos;s written statement that they are accredited and not financed by a
        third party, counts as a reasonable step to verify accreditation. The statement&apos;s hash and whether the
        investor is a person or an entity are recorded on-chain.
      </p>

      <h2>Restrictions after the raise</h2>
      <Aspects
        chain={
          <ul>
            <li>Each raise sets <code>lockup_until</code>. For Reg D the contract refuses anything shorter than one year after the deadline.</li>
            <li>During the lock-up, claimed tokens go straight into the dividend vault and the wallet&apos;s trustline is deauthorized, so tokens can&apos;t move.</li>
            <li>A raise sets <code>max_holders</code> (at most 2,000), and <code>authorize_holder</code> refuses new holders past the cap.</li>
            <li>After the lock-up only wallets that are still eligible can be authorized to hold the token.</li>
          </ul>
        }
        legal={
          <ul>
            <li>Rule 144 holding period for restricted securities sold under Reg D.</li>
            <li>The Exchange Act §12(g) registration trigger at 2,000 holders of record.</li>
            <li>Reg S distribution compliance: tokens shouldn&apos;t flow back to US persons. The residence gate and the authorization flags keep the token with eligible holders.</li>
          </ul>
        }
      />

      <h2>Privacy</h2>
      <p>
        Identity checks are done by Didit, a hosted verification provider. dvdnd&apos;s server reads only the decision
        and the country of residence, issues a credential, and deletes the Didit session with privacy erasure once the
        investor&apos;s proof is registered on Stellar. On-chain, the proof shows only that the wallet belongs to someone
        who lives outside the US. It doesn&apos;t reveal who they are or which country they live in.
      </p>

      <h2>The road from here</h2>
      <ol>
        <li><b>Hackathon:</b> protocol and app on testnet, with real identity checks and real proofs.</li>
        <li><b>Protocol plus 506(c):</b> companies raise from accredited investors and non-US residents through their own compliance agents.</li>
        <li><b>Reg CF through a licensed partner:</b> smaller US tickets go through a registered funding portal.</li>
        <li><b>Own licences:</b> only if the volume justifies a broker-dealer or a funding portal.</li>
      </ol>
      <DocPager slug="legal" />
    </>
  );
}
