"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DOCS, href } from "@/app/docs/pages";
import { NETWORK } from "@/lib/config";

export function DocsNav() {
  const pathname = usePathname();
  const groups = [...new Set(DOCS.map((d) => d.group))];
  return (
    <nav className="docs-nav" aria-label="Docs">
      {groups.map((g) => (
        <div key={g}>
          <div className="label">{g}</div>
          {DOCS.filter((d) => d.group === g).map((d) => (
            <Link key={d.slug} href={href(d)} aria-current={pathname === href(d) ? "page" : undefined}>
              {d.title}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Page header: the page's place in the docs, its title and one-line summary. */
export function DocHeader({ slug }: { slug: string }) {
  const page = DOCS.find((d) => d.slug === slug)!;
  return (
    <header className="doc-header">
      <div className="label">{page.group}</div>
      <h1 className="display doc-title">{page.title}</h1>
      <p className="doc-lede">{page.blurb}</p>
    </header>
  );
}

/** Previous / next links at the foot of each page. */
export function DocPager({ slug }: { slug: string }) {
  const i = DOCS.findIndex((d) => d.slug === slug);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  return (
    <nav className="doc-pager" aria-label="Docs pages">
      {prev ? (
        <Link href={href(prev)}>
          <span className="label">Previous</span>
          <span>{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={href(next)} style={{ textAlign: "right" }}>
          <span className="label">Next</span>
          <span>{next.title}</span>
        </Link>
      )}
    </nav>
  );
}

/**
 * A recording of the real app on Stellar testnet, looping without sound. It
 * loads only near the viewport and stays on its poster when the reader prefers
 * reduced motion.
 */
export function Clip({ name, caption, ratio = "1280 / 800" }: { name: string; caption: React.ReactNode; ratio?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setNear(true);
      if (!el.src) return;
      if (e.isIntersecting && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) void el.play().catch(() => {});
      else el.pause();
    }, { rootMargin: "200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <figure className="clip">
      <div className="clip-frame" style={{ aspectRatio: ratio }}>
        <video
          ref={ref}
          src={near && !still ? `/docs/${name}.mp4` : undefined}
          poster={`/docs/${name}.jpg`}
          muted
          loop
          playsInline
          autoPlay={!still}
          preload="none"
          aria-label={typeof caption === "string" ? caption : undefined}
        />
        <span className="clip-badge">Recorded on Stellar testnet</span>
      </div>
      <figcaption className="small">{caption}</figcaption>
    </figure>
  );
}

/** A still screenshot of the app. */
export function Shot({ name, caption, ratio = "1280 / 800" }: { name: string; caption: React.ReactNode; ratio?: string }) {
  return (
    <figure className="clip">
      <div className="clip-frame" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/docs/${name}.jpg`} alt={typeof caption === "string" ? caption : ""} loading="lazy" />
      </div>
      <figcaption className="small">{caption}</figcaption>
    </figure>
  );
}

/** Two aspects of the same step side by side: on-chain and legal. */
export function Aspects({ chain, legal }: { chain: React.ReactNode; legal: React.ReactNode }) {
  return (
    <div className="aspects">
      <div className="aspect">
        <div className="label aspect-label"><i className="aspect-dot chain" />On-chain</div>
        {chain}
      </div>
      <div className="aspect">
        <div className="label aspect-label"><i className="aspect-dot legal" />Legal</div>
        {legal}
      </div>
    </div>
  );
}

export function Callout({ title, children, tone = "note" }: { title: string; children: React.ReactNode; tone?: "note" | "warn" }) {
  return (
    <aside className={`callout callout-${tone}`}>
      <div className="callout-title">{title}</div>
      <div>{children}</div>
    </aside>
  );
}

/** Numbered steps with a short title and body each. */
export function Steps({ items }: { items: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="steps">
      {items.map((s, i) => (
        <li key={s.title}>
          <span className="num step-n">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <div className="step-title">{s.title}</div>
            <div className="step-body">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A contract or account on the explorer. */
export function Addr({ id, kind = "contract" }: { id: string; kind?: "contract" | "account" | "tx" }) {
  return (
    <a className="mono addr" href={`${NETWORK.explorer}/${kind}/${id}`} target="_blank" rel="noreferrer" title={id}>
      {id.slice(0, 4)}…{id.slice(-4)} ↗
    </a>
  );
}

/** A function call in a contract, set like code. */
export function Fn({ children }: { children: React.ReactNode }) {
  return <code className="fn">{children}</code>;
}
