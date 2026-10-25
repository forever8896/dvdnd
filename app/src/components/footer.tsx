import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>dvdnd · tokenized private equity on Stellar · testnet demo, not investment advice</span>
        <nav aria-label="Footer">
          <Link href="/docs">Docs</Link>
          <Link href="/docs/legal">Legal model</Link>
          <a href="https://github.com/forever8896/dvdnd" target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/.well-known/stellar.toml">stellar.toml</Link>
        </nav>
      </div>
    </footer>
  );
}
