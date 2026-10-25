import Link from "next/link";
import { GeoNotice } from "@/components/ui";

export default function Home() {
  return (
    <main className="page">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
        <div className="label">Tokenized private equity on Stellar</div>
        <h1 className="display">Own a share of real profit. Get paid in dollars.</h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 620 }}>
          Profitable businesses raise USDC at a fixed price against a share of their future profit.
          Lock your tokens for a full period and receive that period&apos;s dividends in USDC.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Link href="/discover" className="btn btn-primary btn-wide">
            Discover raises
          </Link>
          <Link href="/simulation" className="btn btn-secondary btn-wide">
            See the simulation
          </Link>
        </div>
      </div>
      <GeoNotice />
    </main>
  );
}
