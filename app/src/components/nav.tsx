"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isEligible, useWallet } from "@/lib/wallet";
import { Logo } from "./brand";
import { DemoSwitcher } from "./demo-switcher";
import { EligibilityPill, fmt } from "./ui";

const INVESTOR_LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/wallet", label: "Wallet" },
  { href: "/docs", label: "Docs" },
];

const COMPANY_LINKS = [
  { href: "/company", label: "Dashboard" },
  { href: "/company/raise", label: "Raise" },
  { href: "/company/dividend", label: "Pay dividend" },
  { href: "/company/compliance", label: "Compliance" },
];

export function Nav() {
  const pathname = usePathname();
  const { ready, signer, balances, eligibleUntil } = useWallet();
  const companyView = pathname.startsWith("/company");
  const links = companyView ? COMPANY_LINKS : INVESTOR_LINKS;
  const me = companyView ? signer.company : signer.investor;
  const usdc = (companyView ? balances.company : balances.investor)?.usdc ?? 0;

  return (
    <header className="nav">
      <Link href="/" className="nav-brand" aria-label="dvdnd home">
        <Logo height={22} />
        {companyView && <span className="nav-brand-sub">for companies</span>}
      </Link>
      <nav className="nav-links" aria-label="Main">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={
              pathname === l.href || (l.href !== "/company" && pathname.startsWith(l.href)) ? "page" : undefined
            }
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="nav-right">
        <DemoSwitcher />
        {ready && !me && (
          <Link href="/signin" className="btn btn-primary btn-sm">
            Sign in
          </Link>
        )}
        {me && (
          <>
            {!companyView &&
              (isEligible(eligibleUntil) ? (
                <EligibilityPill state="verified" />
              ) : (
                <Link href="/verify" style={{ textDecoration: "none" }}>
                  <EligibilityPill state="unverified" />
                </Link>
              ))}
            <span className="num" style={{ fontSize: 13 }}>
              {fmt(usdc, 2)} <span className="muted">USDC</span>
            </span>
            <Link href={companyView ? "/company" : "/profile"} className="avatar" aria-label="Account">
              {me.publicKey.slice(1, 3)}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
