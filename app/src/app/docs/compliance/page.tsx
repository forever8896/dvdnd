import { Aspects, DocHeader, DocPager, Fn, Shot } from "@/components/docs";

export const metadata = { title: "Compliance controls" };

export default function Compliance() {
  return (
    <>
      <DocHeader slug="compliance" />
      <p>
        Every raise names a compliance account, either the company itself or its transfer agent. That account, and only
        that account, can act on that raise&apos;s holders. dvdnd has no such power.
      </p>
      <Shot name="compliance" caption="The compliance console for Andes Craft Brewing: holders with wallet and vault balances, their status, and the audit log of actions with reasons." />
      <h2>What the compliance account can do</h2>
      <ul>
        <li><b>Freeze</b> a holder (<Fn>freeze_holder</Fn>), for example after a move to the US or a court order. The balance stays; transfers stop.</li>
        <li><b>Unfreeze</b> them (<Fn>unfreeze_holder</Fn>). A lock-up freeze can&apos;t be lifted early this way.</li>
        <li><b>Claw back</b> tokens from a wallet (<Fn>clawback</Fn>), for a court order or a lost wallet.</li>
        <li><b>Hand the role on</b> to a transfer agent (<Fn>set_raise_compliance</Fn>).</li>
      </ul>
      <p>Each action requires a reason, emitted on-chain in a <code>ComplianceAction</code> event and shown in the console&apos;s audit log.</p>
      <Aspects
        chain={
          <ul>
            <li>Holders come from Horizon (every account with a trustline, with its authorization flags) plus vault positions.</li>
            <li>The audit log is rebuilt from the compliance accounts&apos; transaction history, so anyone can audit it independently.</li>
          </ul>
        }
        legal={
          <ul>
            <li>Keeping gatekeeping with the issuer or its registered transfer agent is part of what keeps dvdnd from acting as a broker or transfer agent.</li>
            <li>Recorded reasons give regulators and holders a complete history of every intervention.</li>
          </ul>
        }
      />
      <DocPager slug="compliance" />
    </>
  );
}
