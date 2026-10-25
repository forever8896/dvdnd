"use client";

// Landing hero as pinned scrollytelling: one continuous black-and-white take
// from a baker's hands, through the shop, out onto a street of small
// businesses and into dusk. Three renderings by capability:
//
//  1. Desktop (fine pointer, wide): the scrollbar is the playhead. A rAF loop
//     eases currentTime toward scroll progress; the film is all-intra
//     (keyint=1) so every position seeks instantly.
//  2. Touch / small screens: the acts as small looping clips crossfaded by
//     scroll opacity only (scrubbing while native-scrolling janks on phones).
//  3. Reduced motion or data saver: posters and text in normal flow.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

type Act = { title: string; body: string; poster: string; clip?: string; cta?: boolean };

const ACTS: Act[] = [
  {
    title: "Real businesses make real profit.",
    body: "Bakeries, gyms, breweries, clinics. Profitable for years, and mostly out of reach for ordinary investors.",
    poster: "/film/poster-1.webp",
    clip: "/film/chapter-1.mp4",
  },
  {
    title: "Own a share of it, at a fixed price.",
    body: "A company commits part of its yearly profit to token holders and raises USDC at 1.00 per token. All-or-nothing: if the minimum isn't reached, everyone is refunded.",
    poster: "/film/poster-2.webp",
    clip: "/film/chapter-2.mp4",
  },
  {
    title: "Back the businesses you believe in.",
    body: "Open to investors anywhere outside the US. You prove it with a zero-knowledge proof, and Stellar checks it without learning who you are.",
    poster: "/film/poster-3.webp",
    clip: "/film/chapter-3.mp4",
  },
  {
    title: "Lock your tokens. Get paid in dollars.",
    body: "Every period, the company pays its committed share of profit in USDC to everyone who stayed locked for the whole period.",
    poster: "/film/poster-4.webp",
    cta: true,
  },
];
const N = ACTS.length;

// Film timeline, matching design/film: dough -> counter 0-5.1s, counter ->
// street 5.1-10.1s, street -> dusk 10.1-15.2s.
const FILM = { total: 15.17, src: "/film/dvdnd-film.mp4" };
// [fade in start, fully in, fade out start, gone], in film seconds.
const FILM_TEXT_SEC: [number, number, number, number][] = [
  [0, 0, 2.4, 3.2],
  [3.9, 4.7, 6.6, 7.4],
  [9.3, 10.1, 11.6, 12.4],
  [13.1, 13.9, 15.17, 15.17],
];
const FILM_BOUNDS = [3.6, 8.4, 12.8].map((s) => s / FILM.total);
const filmWindow = (i: number) => FILM_TEXT_SEC[i]!.map((t) => t / FILM.total) as [number, number, number, number];
const chapterWindow = (i: number): [number, number, number, number] => {
  const ws = i / N;
  const we = (i + 1) / N;
  return [ws + 0.015, Math.min(ws + 0.08, we - 0.02), Math.max(we - 0.08, ws + 0.02), we - 0.015];
};

function Scrim() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(90deg, rgba(12,11,10,.84) 0%, rgba(12,11,10,.5) 42%, rgba(12,11,10,.12) 100%), linear-gradient(180deg, rgba(12,11,10,.3) 0%, transparent 28%, transparent 70%, rgba(12,11,10,.55) 100%)",
      }}
    />
  );
}

/** Piecewise-linear and clamped: fade in over [a, b], hold, fade out over [c, d]. */
function envelope(p: number, [a, b, c, d]: [number, number, number, number], first: boolean, last: boolean) {
  const ramp = (x: number, from: number, to: number) => (to <= from ? (x >= to ? 1 : 0) : Math.min(1, Math.max(0, (x - from) / (to - from))));
  const fadeIn = first ? 1 : ramp(p, a, b);
  const fadeOut = last ? 0 : ramp(p, c, d);
  return fadeIn * (1 - fadeOut);
}

function ActText({ act, index, progress, window: w }: { act: Act; index: number; progress: MotionValue<number>; window: [number, number, number, number] }) {
  // The window changes once the client picks a rendering mode; transforms read
  // it from a ref so they always use the current one.
  const windowRef = useRef(w);
  windowRef.current = w;
  const first = index === 0;
  const last = index === N - 1;
  const opacity = useTransform(progress, (p) => envelope(p, windowRef.current, first, last));
  const y = useTransform(progress, (p) => {
    const [a, b, c, d] = windowRef.current;
    if (!first && p < b) return 36 * (1 - Math.min(1, Math.max(0, (p - a) / Math.max(b - a, 1e-6))));
    if (!last && p > c) return -32 * Math.min(1, (p - c) / Math.max(d - c, 1e-6));
    return 0;
  });
  return (
    <motion.div className="film-act" style={{ opacity, y }}>
      <ActCopy act={act} index={index} />
    </motion.div>
  );
}

function ActCopy({ act, index, onLight }: { act: Act; index: number; onLight?: boolean }) {
  return (
    <>
      <div className="film-eyebrow">
        {String(index + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
      </div>
      <h2 className="film-title">{act.title}</h2>
      <p className="film-body" style={onLight ? { color: "var(--muted)" } : undefined}>
        {act.body}
      </p>
      {act.cta && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 28 }}>
          <Link href="/discover" className="btn btn-primary btn-wide">
            Discover raises
          </Link>
          <Link href="/signin" className={`btn btn-wide ${onLight ? "btn-secondary" : "film-btn-ghost"}`}>
            Raise for your company
          </Link>
        </div>
      )}
    </>
  );
}

function ChapterVideo({ act, index, progress, near, setRef }: { act: Act; index: number; progress: MotionValue<number>; near: boolean; setRef: (el: HTMLVideoElement | null) => void }) {
  const F = 0.04;
  const start = index / N;
  const end = (index + 1) / N;
  const opacity = useTransform(
    progress,
    index === 0 ? [0, end - F, end + F] : index === N - 1 ? [start - F, start + F, 1] : [start - F, start + F, end - F, end + F],
    index === 0 ? [1, 1, 0] : index === N - 1 ? [0, 1, 1] : [0, 1, 1, 0],
  );
  return (
    <motion.div style={{ position: "absolute", inset: 0, opacity }}>
      {act.clip ? (
        <video
          ref={setRef}
          src={near ? act.clip : undefined}
          poster={act.poster}
          muted
          loop
          playsInline
          preload={near ? (index === 0 ? "auto" : "metadata") : "none"}
          aria-hidden="true"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={act.poster} alt="" className="film-kenburns" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      <Scrim />
    </motion.div>
  );
}

function StaticFilm() {
  return (
    <section className="page" style={{ gap: 40 }}>
      {ACTS.map((a, i) => (
        <div key={a.title} className="film-static-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.poster} alt="" loading={i ? "lazy" : "eager"} style={{ width: "100%", height: "auto", display: "block" }} />
          <div>
            <ActCopy act={a} index={i} onLight />
          </div>
        </div>
      ))}
    </section>
  );
}

export function LandingFilm() {
  const trackRef = useRef<HTMLElement>(null);
  const filmRef = useRef<HTMLVideoElement>(null);
  const chapterRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const progressRef = useRef(0);
  const smoothRef = useRef(0);
  const [active, setActive] = useState(0);
  const [near, setNear] = useState(false);
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<"pending" | "scrub" | "chapters" | "static">("pending");

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

  useEffect(() => {
    if (mode !== "scrub" && mode !== "chapters") return;
    return scrollYProgress.on("change", (p) => {
      progressRef.current = p;
      const idx = mode === "scrub" ? FILM_BOUNDS.filter((b) => p >= b).length : Math.min(N - 1, Math.max(0, Math.floor(p * N)));
      setActive((prev) => (prev === idx ? prev : idx));
    });
  }, [scrollYProgress, mode]);

  // Scrub loop: ease the playhead toward the scroll target every frame.
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
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  // Chapters: only the active loop plays.
  useEffect(() => {
    if (mode !== "chapters" || !near) return;
    chapterRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) v.play().catch(() => {});
      else if (!v.paused) v.pause();
    });
  }, [active, mode, near]);

  if (mode === "static") return <StaticFilm />;

  return (
    <section
      ref={trackRef}
      aria-label="How dvdnd works"
      style={{ position: "relative", height: mode === "scrub" ? "480vh" : `${N * 110}vh`, background: "#0c0b0a" }}
    >
      <div className="film-stage">
        {mode === "chapters" ? (
          ACTS.map((a, i) => (
            <ChapterVideo key={a.title} act={a} index={i} progress={scrollYProgress} near={near} setRef={(el) => { chapterRefs.current[i] = el; }} />
          ))
        ) : (
          <div style={{ position: "absolute", inset: 0 }}>
            <video
              ref={filmRef}
              src={near && mode === "scrub" ? FILM.src : undefined}
              poster={ACTS[0]!.poster}
              muted
              playsInline
              preload={near ? "auto" : "none"}
              aria-hidden="true"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Scrim />
          </div>
        )}

        <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
          {ACTS.map((a, i) => (
            <ActText key={a.title} act={a} index={i} progress={scrollYProgress} window={mode === "scrub" ? filmWindow(i) : chapterWindow(i)} />
          ))}
        </div>

        <div className="film-rail" aria-hidden="true">
          {ACTS.map((a, i) => (
            <span key={a.title} style={{ background: i === active ? "#f3f2f2" : "rgba(243,242,242,.3)" }} />
          ))}
        </div>
        <div className="film-hint" aria-hidden="true">
          Scroll
        </div>
      </div>
    </section>
  );
}
