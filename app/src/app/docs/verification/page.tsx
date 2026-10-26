import { Aspects, Callout, Clip, DocHeader, DocPager, Steps } from "@/components/docs";

export const metadata = { title: "Proving eligibility" };

export default function Verification() {
  return (
    <>
      <DocHeader slug="verification" />
      <p>
        To invest in a Reg S raise, an investor shows they live outside the United States, once, without putting their
        identity on a public ledger. They pass a hosted identity check; dvdnd turns the verified country into a private
        credential; their browser proves a fact about that credential with a zero-knowledge proof; and a Stellar contract
        verifies the proof.
      </p>
      <Clip name="verify-start" caption="Sign in as an investor, say where you live, and start the identity check. US residents are sent to the accredited route instead. The check itself runs on Didit's own pages." />
      <Steps
        items={[
          {
            title: "Identity check at Didit",
            body: "ID document, a live selfie and a face match, tied to the investor's Stellar address. It works with any Stellar wallet, without a second wallet or an EVM account.",
          },
          {
            title: "Credential issued",
            body: (
              <>
                The browser picks a random secret and sends only its Poseidon hash. dvdnd&apos;s server reads Didit&apos;s decision,
                takes the country of residence, screens the wallet against OFAC&apos;s sanctions list, and adds the leaf{" "}
                <code>Poseidon(country, expiry, Poseidon(secret))</code> to the gate contract&apos;s Merkle tree. One credential
                per ID document.
              </>
            ),
          },
          {
            title: "Private proof in the browser",
            body: "A Groth16 proof that the leaf is in the tree, the country isn't the US or a sanctioned country, the credential hasn't expired, plus a nullifier so one credential registers only one wallet. The secret never leaves the device.",
          },
          {
            title: "Verified on Stellar",
            body: "The gate contract checks the proof with Stellar's BN254 host functions and marks the wallet eligible for 365 days. Didit's copy of the check is then deleted.",
          },
        ]}
      />
      <Clip name="verify-prove" caption="From an issued credential to an eligible wallet: the browser builds the proof, then one transaction verifies it on-chain. The proving wait is shortened." />
      <Aspects
        chain={
          <ul>
            <li><code>gate.verify_and_register</code> checks the root is one of the last 30, the time input is within ten minutes of the ledger, the nullifier is unused and the address hash matches the caller, then runs one pairing check.</li>
            <li>The tree uses Stellar&apos;s Poseidon host function and has depth 16. A verification costs about 30M CPU instructions.</li>
            <li>The proving key comes from a recorded ceremony: Perpetual Powers of Tau plus a phase 2 closed with a Stellar ledger hash as the beacon.</li>
          </ul>
        }
        legal={
          <ul>
            <li>Reg S needs a reasonable basis to believe each buyer is outside the US. The identity check gives that basis; the proof carries it on-chain.</li>
            <li>Any US document or US nationality counts as US residence.</li>
            <li>dvdnd keeps only the country. Didit&apos;s session is erased once the proof is registered.</li>
          </ul>
        }
      />
      <Callout title="Living in the US?">
        US residents can&apos;t get a Reg S credential. They invest in raises marked 506(c) as accredited investors instead:
        see <a href="/docs/investing">Investing in a raise</a>.
      </Callout>
      <Callout title="About the recording" tone="warn">
        Didit&apos;s hosted check needs a real ID document, so in the second clip a credential issued directly by the
        testnet issuer stands in for an approved check. Everything after that is the real flow: the proof is built in the
        browser and verified by the gate contract on testnet.
      </Callout>
      <DocPager slug="verification" />
    </>
  );
}
