import Link from "next/link";
import { Aspects, Callout, Clip, DocHeader, DocPager, Shot } from "@/components/docs";
import { DOCS, href } from "./pages";

export const metadata = { title: "How dvdnd works" };

const FLOW = [
  { t: "List", b: "A profitable company proves it owns the business and signs an agreement committing a share of yearly profit." },
  { t: "Raise", b: "It opens a fixed-price, all-or-nothing raise in USDC under Reg S, Reg D 506(c) or both." },
  { t: "Escrow", b: "Eligible investors commit USDC. Full raise: the company is paid. Missed minimum: everyone is refunded." },
  { t: "Earn", b: "Tokens sit in the dividend vault during the lock-up. Each period the company pays its share of profit in USDC." },
  { t: "Trade", b: "After the lock-up, holders trade on Stellar's order book, but only with other eligible holders." },
];

export default function DocsHome() {
  return (
    <>
      <DocHeader slug="" />
      <p>
        dvdnd lets profitable small and mid-sized businesses raise money by selling a share of their future profit, and
        lets ordinary investors own that share and get paid in dollars. Everything that moves money or decides who may
        hold a token runs in Soroban contracts on Stellar. The legal agreement, the identity check and company due
        diligence happen off-chain, and each leaves a hash or a proof on-chain.
      </p>
      <div className="flow" role="list">
        {FLOW.map((s, i) => (
          <div key={s.t} role="listitem">
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
            <b>{s.t}</b>
            <span className="muted">{s.b}</span>
          </div>
        ))}
      </div>
      <Shot name="raise" caption="A raise page: profit committed, target yield, the exemption it runs under, its lock-up and the escrow contract." />

      <h2>What is different from a token launchpad</h2>
      <ul>
        <li><b>One price for everyone.</b> There is no bonding curve, so the first buyer has no edge over the last.</li>
        <li><b>Money goes to a business once.</b> The company receives the raise when it closes, and pays dividends from real profit afterwards. There is no buyback.</li>
        <li><b>Holding is restricted by the protocol.</b> Share tokens are issued with Stellar&apos;s authorization flags, so a wallet the offering hasn&apos;t admitted can&apos;t hold one, on any venue.</li>
        <li><b>Patience is paid.</b> Only tokens locked for a full period share that period&apos;s dividend.</li>
      </ul>
      <Aspects
        chain={
          <ul>
            <li><code>registry</code> holds companies and agreement hashes.</li>
            <li><code>gate</code> verifies zero-knowledge residence proofs.</li>
            <li><code>offering</code> runs escrow and admits holders.</li>
            <li><code>vault</code> pays dividends.</li>
            <li><code>timelock</code> delays every admin change.</li>
          </ul>
        }
        legal={
          <ul>
            <li>dvdnd is built as compliance software, not a broker.</li>
            <li>It charges a flat listing fee per raise and never holds investor money.</li>
            <li>Each raise runs under a securities exemption, and its rules are enforced in the contract.</li>
          </ul>
        }
      />
      <Clip name="lifecycle" caption="The whole lifecycle on testnet, in six scenes: a company finds itself in the register, opens a ten-minute raise, an investor proves eligibility and invests, the company closes the full raise and is paid, and profits come back as a USDC dividend." />
      <Callout title="Everything here is live on testnet">
        The clips on these pages were recorded on the deployed app against Stellar testnet. Every transaction they show is
        on the explorer, and the full log of demo transactions is in{" "}
        <a href="https://github.com/forever8896/dvdnd/blob/main/deployments/evidence.md" target="_blank" rel="noreferrer">deployments/evidence.md</a>.
      </Callout>

      <h2>Read by topic</h2>
      <div className="doc-cards">
        {DOCS.filter((d) => d.slug).map((d) => (
          <Link key={d.slug} href={href(d)}>
            <span className="label">{d.group}</span>
            <span className="doc-card-title">{d.title}</span>
            <span className="small">{d.blurb}</span>
          </Link>
        ))}
      </div>
      <DocPager slug="" />
    </>
  );
}
