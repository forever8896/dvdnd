"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "./icons";

const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/wallet", label: "Wallet" },
  { href: "/simulation", label: "Simulation" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="nav">
      <Link href="/" className="nav-brand">
        dvdnd
      </Link>
      <nav className="nav-links" aria-label="Main">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={pathname.startsWith(l.href) ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="nav-right">
        <span className="pill pill-green">
          <ShieldCheck size={11} />
          Verified
        </span>
        <span className="num" style={{ fontSize: 13 }}>
          1,240.00 <span className="muted">USDC</span>
        </span>
        <Link href="/profile" className="avatar" aria-label="Profile">
          AM
        </Link>
      </div>
    </header>
  );
}
