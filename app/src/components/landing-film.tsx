"use client";

// Landing films as pinned scrollytelling. Each film is one continuous colour
// take (design/film/v2), rendered three ways by capability:
//
//  1. Desktop (fine pointer, wide): the scrollbar is the playhead. A rAF loop
//     eases currentTime toward scroll progress; the film is all-intra
//     (keyint=1) so every position seeks instantly.
//  2. Touch / small screens: each beat is a small looping clip, crossfaded by
//     scroll opacity only (scrubbing while native-scrolling janks on phones).
//  3. Reduced motion or data saver: posters and text in normal flow.
//
// Film A's globe segment is rendered by scripts/film/globe, which also exports
// where each highlighted country sits on every frame; in scrub mode those
// positions drive HTML country labels so names stay crisp over the video.

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

type Window4 = [number, number, number, number];

type Beat = {
  eyebrow: string;
  title: string;
  body?: string;
  /** Small print under the body: a source line or a legend. */
  note?: string;
  links?: { label: string; href: string }[];
  /** Renders the eyebrow as a large animated "flash" badge. */
  flash?: boolean;
  /** A highlighted source block, e.g. the regulation the beat refers to. */
  callout?: { label: string; title: string; says: string; means: string; href: string };
  /** [fade in start, fully in, fade out start, gone], in film seconds. */
  sec: Window4;
  poster: string;
  clip: string;
};

type Film = {
  id: string;
  label: string;
  src: string;
  total: number;
  vhPerSecond: number;
  beats: Beat[];
  globe?: { start: number; frames: number; fps: number; labels: string };
};

const A = "/film/v2/a";
const B = "/film/v2/b";

// Film A cut (seconds, from scripts/film/v2-assemble.sh): T1 0–5.04, T2 5.04–10.08, globe 10.08–22.04,
// T4 22.04–27.08, T5 27.08–32.13, T6 32.13–37.17, T7 37.17–42.25.
export const FILM_A: Film = {
  id: "film-a",
  label: "Why private equity is hard to reach",
  src: `${A}.mp4`,
  total: 42.25,
  vhPerSecond: 26,
  globe: { start: 10.083, frames: 288, fps: 24, labels: "/film/v2/globe-labels.json" },
  beats: [
    {
      eyebrow: "dvdnd",
      title: "Private equity, made accessible.",
      body: "Invest in real businesses with real revenue. Earn dividends, on-chain.",
      sec: [0, 0, 4.4, 5.4],
      poster: `${A}-1.webp`,
      clip: `${A}-1.mp4`,
    },
    {
      eyebrow: "The problem · businesses",
      title: "Today 40% of businesses globally can't access the growth capital they need.",
      body: "That's 65 million firms in developing economies, with an unmet financing need of $5.2 trillion a year.",
      note: "▲ Capital-constrained markets · Source: IFC, MSME Finance Gap (2017)",
      sec: [12, 13, 24.6, 25.6],
      poster: `${A}-3.webp`,
      clip: `${A}-3.mp4`,
    },
    {
      eyebrow: "The problem · investors",
      title: "Meanwhile investors are rushing from venture bets to steady private equity.",
      body: "Venture LP commitments are at their lowest point in a decade, with private equity investment growing to $2.1 trillion in 2025.",
      note: "Sources: PitchBook-NVCA Venture Monitor Q4 2025 · KPMG Pulse of Private Equity Q4'25",
      sec: [27.6, 28.6, 34.4, 35.4],
      poster: `${A}-5.webp`,
      clip: `${A}-5.mp4`,
    },
    {
      eyebrow: "The problem · investors",
      title: "But the best opportunities are hard to reach.",
      body: "They're abroad, unlisted, and expensive to find, check and buy into.",
      sec: [36.2, 37.2, 42.25, 42.25],
      poster: `${A}-6.webp`,
      clip: `${A}-6.mp4`,
    },
  ],
};

// Film B cut (seconds): T8 0–5.04, T9 5.04–10.08, T10 10.08–15.17.
export const FILM_B: Film = {
  id: "film-b",
  label: "Introducing dvdnd",
  src: `${B}.mp4`,
  total: 15.17,
  vhPerSecond: 36,
  beats: [
    {
      eyebrow: "Introducing",
      title: "dvdnd. Private equity, made accessible.",
      sec: [0, 0, 2.4, 3.0],
      poster: `${B}-1.webp`,
      clip: `${B}-1.mp4`,
    },
    {
      eyebrow: "For businesses",
      title: "Raise growth capital from verified investors worldwide.",
      body: "Offer a share of your profit as tokens through Reg D 506(c) and Reg S offerings, with the holding rules enforced by the token itself.",
      sec: [3.4, 4.1, 6.6, 7.3],
      poster: `${B}-2.webp`,
      clip: `${B}-2.mp4`,
    },
    {
      eyebrow: "For investors",
      title: "Own a share of profitable private businesses, internationally.",
      body: "Prove you're eligible once, invest at a fixed price, lock your tokens and receive your share of profit in USDC.",
      sec: [7.7, 8.4, 10.9, 11.6],
      poster: `${B}-3.webp`,
      clip: `${B}-3.mp4`,
    },
    {
      eyebrow: "News flash",
      flash: true,
      title: "Real businesses can now raise on-chain, inside the rules.",
      callout: {
        label: "SEC–CFTC interpretation · March 17, 2026",
        title: "Application of the federal securities laws to crypto assets",
        says: "A security represented as a token is still a security, whether it's recorded on-chain or off-chain.",
        means: "On-chain shares can use the same proven exemptions as any private raise: Reg D 506(c) and Reg S.",
        href: "https://www.sullcrom.com/insights/memo/2026/March/SEC-Clarifies-Application-Securities-Laws-Crypto-Assets",
      },
      sec: [12, 12.7, 15.17, 15.17],
      poster: `${B}-4.webp`,
      clip: `${B}-4.mp4`,
    },
  ],
};

const ramp = (x: number, from: number, to: number) => (to <= from ? (x >= to ? 1 : 0) : Math.min(1, Math.max(0, (x - from) / (to - from))));

/** Piecewise-linear and clamped: fade in over [a, b], hold, fade out over [c, d]. */
function envelope(p: number, [a, b, c, d]: Window4, first: boolean, last: boolean) {
  const fadeIn = first ? 1 : ramp(p, a, b);
  const fadeOut = last ? 0 : ramp(p, c, d);
  return fadeIn * (1 - fadeOut);
}

function Scrim() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(90deg, rgba(12,11,10,.8) 0%, rgba(12,11,10,.42) 40%, rgba(12,11,10,.06) 100%), linear-gradient(180deg, rgba(12,11,10,.28) 0%, transparent 26%, transparent 72%, rgba(12,11,10,.5) 100%)",
      }}
    />
  );
}

function BeatCopy({ beat, onLight }: { beat: Beat; onLight?: boolean }) {
  return (
    <>
      {beat.flash ? (
        <div className="film-flash">
          <span className="film-flash-dot" aria-hidden="true" />
          {beat.eyebrow}
        </div>
      ) : (
        <div className="film-eyebrow" style={onLight ? { color: "var(--muted)" } : undefined}>
          {beat.eyebrow}
        </div>
      )}
      <h2 className="film-title">{beat.title}</h2>
      {beat.body && (
        <p className="film-body" style={onLight ? { color: "var(--muted)" } : undefined}>
          {beat.body}
        </p>
      )}
      {beat.links && (
        <ul className="film-links">
          {beat.links.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noreferrer">
                › {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      {beat.callout && (
        <div className={`film-callout${onLight ? " on-light" : ""}`}>
          <div className="film-callout-label">{beat.callout.label}</div>
          <div className="film-callout-title">{beat.callout.title}</div>
          <dl>
            <dt>What it says</dt>
            <dd>{beat.callout.says}</dd>
            <dt>What it means for dvdnd</dt>
            <dd>{beat.callout.means}</dd>
          </dl>
          <a href={beat.callout.href} target="_blank" rel="noreferrer">
            Read a summary of the interpretation ↗
          </a>
        </div>
      )}
      {beat.note && (
        <p className="film-note" style={onLight ? { color: "var(--muted)" } : undefined}>
          {beat.note}
        </p>
      )}
    </>
  );
}

function BeatText({ beat, first, last, progress, window: w }: { beat: Beat; first: boolean; last: boolean; progress: MotionValue<number>; window: Window4 }) {
  // The window changes once the client picks a rendering mode; transforms read
  // it from a ref so they always use the current one.
  const windowRef = useRef(w);
  windowRef.current = w;
  const opacity = useTransform(progress, (p) => envelope(p, windowRef.current, first, last));
  const y = useTransform(progress, (p) => {
    const [a, b, c, d] = windowRef.current;
    if (!first && p < b) return 36 * (1 - ramp(p, a, Math.max(b, a + 1e-6)));
    if (!last && p > c) return -32 * ramp(p, c, Math.max(d, c + 1e-6));
    return 0;
  });
  const pointerEvents = useTransform(opacity, (o) => (o > 0.5 ? "auto" : "none"));
  return (
    <motion.div className="film-act" style={{ opacity, y, pointerEvents }}>
      <BeatCopy beat={beat} />
    </motion.div>
  );
}

function ChapterVideo({ beat, index, count, progress, near, setRef }: { beat: Beat; index: number; count: number; progress: MotionValue<number>; near: boolean; setRef: (el: HTMLVideoElement | null) => void }) {
  const F = 0.04;
  const start = index / count;
  const end = (index + 1) / count;
  const opacity = useTransform(
    progress,
    index === 0 ? [0, end - F, end + F] : index === count - 1 ? [start - F, start + F, 1] : [start - F, start + F, end - F, end + F],
    index === 0 ? [1, 1, 0] : index === count - 1 ? [0, 1, 1] : [0, 1, 1, 0],
  );
  return (
    <motion.div style={{ position: "absolute", inset: 0, opacity }}>
      <video
        ref={setRef}
        src={near ? beat.clip : undefined}
        poster={beat.poster}
        muted
        loop
        playsInline
        preload={near ? (index === 0 ? "auto" : "metadata") : "none"}
        aria-hidden="true"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <Scrim />
    </motion.div>
  );
}

function StaticFilm({ film }: { film: Film }) {
  return (
    <section className="page" style={{ gap: 40 }} aria-label={film.label}>
      {film.beats.map((b, i) => (
        <div key={b.title} className="film-static-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.poster} alt="" loading={i ? "lazy" : "eager"} style={{ width: "100%", height: "auto", display: "block" }} />
          <div>
            <BeatCopy beat={b} onLight />
          </div>
        </div>
      ))}
    </section>
  );
}

type LabelFrame = { iso: string; name: string; x: number; y: number; o: number }[];

export function LandingFilm({ film }: { film: Film }) {
  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const filmRef = useRef<HTMLVideoElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<{ width: number; height: number; frames: LabelFrame[] } | null>(null);
  const chapterRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const progressRef = useRef(0);
  const smoothRef = useRef(0);
  const [active, setActive] = useState(0);
  const [near, setNear] = useState(false);
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<"pending" | "scrub" | "chapters" | "static">("pending");
  const N = film.beats.length;

  // Decide the rendering once on the client: capability, not user agent.
  useEffect(() => {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const lite = Boolean(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType ?? "")));
    // ?film=scrub|chapters|static previews a rendering regardless of device.
    const forced = new URLSearchParams(location.search).get("film");
    if (forced === "scrub" || forced === "chapters" || forced === "static") setMode(forced);
    else if (reduced || lite) setMode("static");
    else if (window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 900) setMode("scrub");
    else setMode("chapters");
  }, [reduced]);

  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end end"] });

  // Attach video sources only when the section is within ~1.5 viewports.
  useEffect(() => {
    if (mode === "static" || mode === "pending" || near) return;
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "150% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [mode, near]);

  // Country label positions for the globe segment, scrub mode only.
  useEffect(() => {
    if (mode !== "scrub" || !near || !film.globe || labelsRef.current) return;
    fetch(film.globe.labels)
      .then((r) => r.json())
      .then((d) => {
        labelsRef.current = d;
      })
      .catch(() => {});
  }, [mode, near, film.globe]);

  const bounds = film.beats.slice(1).map((b, i) => (film.beats[i]!.sec[3] + b.sec[0]) / 2 / film.total);

  useEffect(() => {
    if (mode !== "scrub" && mode !== "chapters") return;
    return scrollYProgress.on("change", (p) => {
      progressRef.current = p;
      const idx = mode === "scrub" ? bounds.filter((b) => p >= b).length : Math.min(N - 1, Math.max(0, Math.floor(p * N)));
      setActive((prev) => (prev === idx ? prev : idx));
    });
    // bounds derive from the static film config
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollYProgress, mode, N]);

  // Scrub loop: ease the playhead toward the scroll target every frame, and
  // move the globe's country labels with it.
  useEffect(() => {
    if (mode !== "scrub") return;
    let raf = 0;
    const tick = () => {
      const v = filmRef.current;
      if (v && v.duration && !Number.isNaN(v.duration)) {
        const target = progressRef.current * (v.duration - 0.05);
        smoothRef.current += (target - smoothRef.current) * 0.14;
        if (Math.abs(v.currentTime - smoothRef.current) > 0.02) {
          try {
            v.currentTime = smoothRef.current;
          } catch {
            /* not seekable yet */
          }
        }
      }
      placeLabels(smoothRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // placeLabels only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function placeLabels(t: number) {
    const layer = labelLayerRef.current;
    const data = labelsRef.current;
    const stage = stageRef.current;
    if (!layer || !stage) return;
    const g = film.globe;
    const f = g ? Math.round((t - g.start) * g.fps) : -1;
    const frame = data && g && f >= 0 && f < g.frames ? data.frames[f] : undefined;
    if (!frame || !data) {
      if (layer.childElementCount) layer.replaceChildren();
      return;
    }
    // Map film pixels to the stage the same way object-fit: cover does.
    const w = stage.clientWidth, h = stage.clientHeight;
    const s = Math.max(w / data.width, h / data.height);
    const ox = (w - data.width * s) / 2, oy = (h - data.height * s) / 2;
    const seen = new Set<string>();
    for (const l of frame) {
      seen.add(l.iso);
      let el = layer.querySelector<HTMLSpanElement>(`[data-iso="${l.iso}"]`);
      if (!el) {
        el = document.createElement("span");
        el.dataset.iso = l.iso;
        el.className = "film-country";
        el.textContent = l.name;
        layer.appendChild(el);
      }
      const x = ox + l.x * s;
      el.style.transform = `translate(${x.toFixed(1)}px, ${(oy + l.y * s).toFixed(1)}px)`;
      // Fade labels out on the left, where the headline sits.
      el.style.opacity = String(l.o * ramp(x / w, 0.4, 0.5));
    }
    for (const el of Array.from(layer.children) as HTMLElement[]) if (!seen.has(el.dataset.iso!)) el.remove();
  }

  // Chapters: only the active loop plays.
  useEffect(() => {
    if (mode !== "chapters" || !near) return;
    chapterRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) v.play().catch(() => {});
      else if (!v.paused) v.pause();
    });
  }, [active, mode, near]);

  if (mode === "static") return <StaticFilm film={film} />;

  const filmWindow = (i: number) => film.beats[i]!.sec.map((t) => t / film.total) as Window4;
  const chapterWindow = (i: number): Window4 => {
    const ws = i / N;
    const we = (i + 1) / N;
    return [ws + 0.015, Math.min(ws + 0.08, we - 0.02), Math.max(we - 0.08, ws + 0.02), we - 0.015];
  };

  return (
    <section
      ref={trackRef}
      id={film.id}
      aria-label={film.label}
      style={{ position: "relative", height: mode === "scrub" ? `${Math.round(film.total * film.vhPerSecond)}vh` : `${N * 110}vh`, background: "#0c0b0a" }}
    >
      <div className="film-stage" ref={stageRef}>
        {mode === "chapters" ? (
          film.beats.map((b, i) => (
            <ChapterVideo key={b.title} beat={b} index={i} count={N} progress={scrollYProgress} near={near} setRef={(el) => { chapterRefs.current[i] = el; }} />
          ))
        ) : (
          <div style={{ position: "absolute", inset: 0 }}>
            <video
              ref={filmRef}
              src={near && mode === "scrub" ? film.src : undefined}
              poster={film.beats[0]!.poster}
              muted
              playsInline
              preload={near ? "auto" : "none"}
              aria-hidden="true"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Scrim />
            <div ref={labelLayerRef} className="film-countries" aria-hidden="true" />
          </div>
        )}

        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
          {film.beats.map((b, i) => (
            <BeatText key={b.title} beat={b} first={i === 0} last={i === N - 1} progress={scrollYProgress} window={mode === "scrub" ? filmWindow(i) : chapterWindow(i)} />
          ))}
        </div>

        <div className="film-rail" aria-hidden="true">
          {film.beats.map((b, i) => (
            <span key={b.title} style={{ background: i === active ? "#f3f2f2" : "rgba(243,242,242,.3)" }} />
          ))}
        </div>
        {film.id === "film-a" && (
          <div className="film-hint" aria-hidden="true">
            Scroll
          </div>
        )}
      </div>
    </section>
  );
}
