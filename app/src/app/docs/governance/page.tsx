import { Addr, Aspects, Callout, DocHeader, DocPager, Fn } from "@/components/docs";
import { CONTRACTS } from "@/lib/config";

export const metadata = { title: "Contracts and governance" };

const TIMELOCK = "CCHX6UXEPIXLRALJIK2JZWCQ3OLQER7HYOGFVYYYSOP2UJERLEEEGCGZ";
const COUNCIL = "GAS3HWOIZHRBYTQMRSHH2KYODGA323TOJB426DM7RVELK7LJEJBVZWVV";

export default function Governance() {
  const rows: [string, string, string, "contract" | "account"][] = [
    ["registry", CONTRACTS.registry, "Companies, statuses, agreement hashes, payout share and schedule.", "contract"],
    ["gate", CONTRACTS.gate, "Credential Merkle tree (Poseidon) and Groth16 verification of residence proofs.", "contract"],
    ["offering", CONTRACTS.offering, "Raises, escrow, per-raise terms, eligibility, minting and holder authorization.", "contract"],
    ["vault", CONTRACTS.vault, "Locks and pro-rata USDC dividends per share token.", "contract"],
    ["timelock", TIMELOCK, "Admin of registry and offering; delays every admin change.", "contract"],
    ["council", COUNCIL, "2-of-3 multisig account, master key disabled; the timelock's proposer.", "account"],
  ];
  return (
    <>
      <DocHeader slug="governance" />
      <p>
        dvdnd is five Soroban contracts written in Rust, one share token per company and Circle USDC. Testnet
        deployments:
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Contract</th><th>Role</th><th className="r">Address</th></tr></thead>
          <tbody>
            {rows.map(([name, id, role, kind]) => (
              <tr key={name}><td><code>{name}</code></td><td>{role}</td><td className="r"><Addr id={id} kind={kind} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Who can change what</h2>
      <ul>
        <li><b>The council</b>, a 2-of-3 multisig, can suspend companies and set the listing fee, but only through the timelock.</li>
        <li><b>The platform key</b> verifies companies after the ownership check and issues credentials after an identity check. It can&apos;t move money or tokens.</li>
        <li><b>Each raise&apos;s compliance account</b> acts on that raise&apos;s holders, with a recorded reason.</li>
        <li><b>Nobody</b> can withdraw escrow, mint more tokens after a raise, or take dividends from the vault.</li>
      </ul>

      <h2>The timelock</h2>
      <p>
        The registry and offering contracts take the timelock as their admin. The council <Fn>schedule</Fn>s a call (a
        target contract, a function and its arguments); after the delay anyone can <Fn>execute</Fn> it; until then the
        council can <Fn>cancel</Fn> it. Holders and companies see every pending admin change on-chain before it takes
        effect. Changing the delay or the proposer is itself a scheduled call, so it waits out the current delay too.
      </p>
      <Aspects
        chain={
          <ul>
            <li>A call&apos;s id is the sha256 of its target, function and arguments, independent of time, so the transaction footprint is known when it is scheduled.</li>
            <li>The delay is 10 minutes on testnet, for demos. Production would use days.</li>
            <li>The council signs with <code>council-invoke.sh</code>: build, simulate, collect two signatures, send.</li>
          </ul>
        }
        legal={
          <ul>
            <li>No single key, including dvdnd&apos;s, can change the rules of a live raise.</li>
            <li>A visible delay before admin changes is what investors would expect from a transfer agent or a fund administrator.</li>
          </ul>
        }
      />

      <h2>Stellar features doing the work</h2>
      <table className="table">
        <tbody>
          <tr><td><b>BN254 host functions</b></td><td>Groth16 verification in the gate: <code>g1_msm</code> and one <code>pairing_check</code>.</td></tr>
          <tr><td><b>Poseidon host function</b></td><td>The credential tree and the address binding, matching circomlib&apos;s Poseidon.</td></tr>
          <tr><td><b>Asset authorization flags</b></td><td>Only authorized wallets can hold a share token; clawback for court orders.</td></tr>
          <tr><td><b>Stellar Asset Contract</b></td><td>The offering is the SAC admin: it mints exactly what was sold and authorizes holders.</td></tr>
          <tr><td><b>SDEX and path payments</b></td><td>Secondary trading and XLM → USDC in one operation.</td></tr>
          <tr><td><b>SEP-10, SEP-24, SEP-1</b></td><td>Anchor sign-in and bank transfers; a <code>stellar.toml</code> generated from the chain.</td></tr>
        </tbody>
      </table>
      <Callout title="Before mainnet" tone="warn">
        The contracts haven&apos;t been audited. The trusted setup has one phase-2 contributor so far, and more
        independent contributions are needed. Identity checks would move to Didit&apos;s paid workflow with proof of
        address and AML screening.
      </Callout>
      <DocPager slug="governance" />
    </>
  );
}
