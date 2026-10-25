"use client";

// Small SVG charts for the simulation page. Colors follow the entity, never
// its rank: dvdnd is always series 1, memecoins series 2, and so on. Every
// chart has a hover tooltip, a legend for two or more series, and a table view.

import { useId, useRef, useState } from "react";

export type SeriesKey = "dividend" | "meme" | "realestate" | "bdc" | "fair";
export const SERIES: Record<SeriesKey, { label: string; color: string }> = {
  dividend: { label: "dvdnd raises", color: "var(--c1)" },
  meme: { label: "Memecoins", color: "var(--c2)" },
  realestate: { label: "Real-estate tokens", color: "var(--c3)" },
  bdc: { label: "Listed BDC", color: "var(--c4)" },
  /** A reference line, not a series: ink, dashed. */
  fair: { label: "Fair value", color: "var(--muted)" },
};

export const pct = (x: number, d = 0) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : "—");
export const usd = (v: number) => {
  const x = Math.abs(v) < 0.5 ? 0 : v;
  return (
      Math.abs(x) >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : Math.abs(x) >= 1e3 ? `$${(x / 1e3).toFixed(1)}k` : `$${x.toFixed(0)}`
  );
};

export function Legend({ keys, extra }: { keys: SeriesKey[]; extra?: React.ReactNode }) {
  return (
    <div className="chart-legend">
      {keys.map((k) => (
        <span key={k}>
          <i style={{ background: SERIES[k].color }} />
          {SERIES[k].label}
        </span>
      ))}
      {extra}
    </div>
  );
}

/** A chart card with a chart/table switch, so no reading depends on color alone. */
export function ChartCard({ title, note, children, table }: { title: string; note?: React.ReactNode; children: React.ReactNode; table?: React.ReactNode }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="chart-card">
      <div className="chart-head">
        <div>
          <h2 className="h3">{title}</h2>
          {note && <p className="small" style={{ marginTop: 2, maxWidth: 640 }}>{note}</p>}
        </div>
        {table && (
          <div className="seg seg-sm" role="group" aria-label={`${title} view`}>
            <button aria-pressed={view === "chart"} onClick={() => setView("chart")}>Chart</button>
            <button aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
          </div>
        )}
      </div>
      {view === "chart" || !table ? children : <div className="table-wrap chart-table">{table}</div>}
    </section>
  );
}

type Line = { key: SeriesKey; points: { x: number; y: number }[]; dashed?: boolean };

const W = 640;
const H = 260;
const M = { t: 12, r: 30, b: 32, l: 48 };

function ticks(min: number, max: number, n = 5) {
  const span = max - min || 1;
  const step = Math.pow(10, Math.floor(Math.log10(span / n)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => span / s <= n) ?? step * 10;
  const out = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max + 1e-9; v += nice) out.push(Math.round(v / nice) * nice);
  return out;
}

/**
 * Line chart with a crosshair: hovering snaps to the nearest x and lists every
 * series' value there. One y axis only.
 */
export function LineChart({
  lines,
  xFormat,
  yFormat,
  xLabel,
  yDomain,
  xTicks,
  reference,
  step,
}: {
  lines: Line[];
  xFormat: (x: number) => string;
  yFormat: (y: number) => string;
  xLabel: string;
  yDomain?: [number, number];
  xTicks?: number[];
  /** A dashed reference line through two points, e.g. perfect equality. */
  reference?: { from: [number, number]; to: [number, number]; label: string };
  step?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const clip = useId();
  const [hover, setHover] = useState<number | null>(null);
  const xs = [...new Set(lines.flatMap((l) => l.points.map((p) => p.x)))].sort((a, b) => a - b);
  const ys = lines.flatMap((l) => l.points.map((p) => p.y));
  const [x0, x1] = [xs[0] ?? 0, xs[xs.length - 1] ?? 1];
  const [y0, y1] = yDomain ?? [Math.min(0, ...ys), Math.max(...ys) * 1.08 || 1];
  const sx = (x: number) => M.l + ((x - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const sy = (y: number) => H - M.b - ((y - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const path = (pts: { x: number; y: number }[]) =>
    pts
      .map((p, i) => {
        if (!step || i === 0) return `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
        return `H${sx(p.x).toFixed(1)}V${sy(p.y).toFixed(1)}`;
      })
      .join("");
  const yt = ticks(y0, y1);
  const xt = xTicks ?? ticks(x0, x1, 6);

  function move(e: React.PointerEvent) {
    const box = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    xs.forEach((v, i) => Math.abs(sx(v) - x) < Math.abs(sx(xs[best]) - x) && (best = i));
    setHover(best);
  }

  const hx = hover === null ? null : xs[hover];
  return (
    <div className="chart-box">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${lines.map((l) => SERIES[l.key].label).join(", ")} by ${xLabel}`} onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <defs>
          <clipPath id={clip}>
            <rect x={M.l} y={M.t - 2} width={W - M.l - M.r} height={H - M.t - M.b + 4} />
          </clipPath>
        </defs>
        {yt.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} className={t === 0 ? "axis" : "grid"} />
            <text x={M.l - 6} y={sy(t)} className="tick" textAnchor="end" dominantBaseline="middle">{yFormat(t)}</text>
          </g>
        ))}
        {xt.map((t) => (
          <text key={t} x={sx(t)} y={H - M.b + 16} className="tick" textAnchor="middle">{xFormat(t)}</text>
        ))}
        <text x={W - M.r} y={H - 2} className="tick" textAnchor="end">{xLabel}</text>
        {reference && (
          <g>
            <line x1={sx(reference.from[0])} y1={sy(reference.from[1])} x2={sx(reference.to[0])} y2={sy(reference.to[1])} className="ref" />
            <text x={sx((reference.from[0] + reference.to[0]) / 2) - 8} y={sy((reference.from[1] + reference.to[1]) / 2) - 8} className="tick" textAnchor="end">{reference.label}</text>
          </g>
        )}
        <g clipPath={`url(#${clip})`}>
          {lines.map((l) => (
            <path key={l.key} d={path(l.points)} fill="none" stroke={SERIES[l.key].color} strokeWidth={2} strokeDasharray={l.dashed ? "5 4" : undefined} strokeLinejoin="round" />
          ))}
        </g>
        {hx !== null && (
          <g>
            <line x1={sx(hx)} x2={sx(hx)} y1={M.t} y2={H - M.b} className="crosshair" />
            {lines.map((l) => {
              const p = l.points.find((q) => q.x === hx);
              return p && <circle key={l.key} cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill={SERIES[l.key].color} stroke="var(--bg)" strokeWidth={2} />;
            })}
          </g>
        )}
      </svg>
      {hx !== null && (
        <div className="chart-tip" style={{ left: `${(sx(hx) / W) * 100}%` }}>
          <b>{xFormat(hx)}</b>
          {lines.map((l) => {
            const p = l.points.find((q) => q.x === hx);
            return (
              p && (
                <div key={l.key}>
                  <i style={{ background: SERIES[l.key].color }} />
                  {SERIES[l.key].label} <span className="num">{yFormat(p.y)}</span>
                </div>
              )
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Diverging fill for a signed value: blue for gains, red for losses, gray at zero. */
function diverging(v: number, max: number) {
  if (!Number.isFinite(v)) return "var(--surface)";
  const t = Math.min(1, Math.abs(v) / max);
  const pole = v >= 0 ? "var(--div-pos)" : "var(--div-neg)";
  return `color-mix(in oklab, ${pole} ${Math.round(t * 100)}%, var(--div-mid))`;
}

export function Heatmap({
  rows,
  cols,
  value,
  rowLabel,
  colLabel,
  rowFormat,
  colFormat,
  marker,
}: {
  rows: number[];
  cols: number[];
  value: (row: number, col: number) => number;
  rowLabel: string;
  colLabel: string;
  rowFormat: (v: number) => string;
  colFormat: (v: number) => string;
  marker?: { row: number; col: number };
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const all = rows.flatMap((r) => cols.map((c) => value(r, c))).filter(Number.isFinite);
  const max = Math.max(0.05, ...all.map(Math.abs));
  return (
    <div className="heat" style={{ gridTemplateColumns: `56px repeat(${cols.length}, 1fr)` }} onPointerLeave={() => setHover(null)}>
      <div className="heat-corner small">{rowLabel} ↓ · {colLabel} →</div>
      {cols.map((c) => (
        <div key={c} className="heat-col small num">{colFormat(c)}</div>
      ))}
      {rows.map((r) => (
        <div key={r} style={{ display: "contents" }}>
          <div className="heat-row small num">{rowFormat(r)}</div>
          {cols.map((c) => {
            const v = value(r, c);
            const strong = Math.abs(v) / max > 0.55;
            const here = marker && Math.abs(marker.row - r) < 1e-9 && Math.abs(marker.col - c) < 1e-9;
            return (
              <div
                key={c}
                className="heat-cell num"
                data-strong={strong}
                data-here={here}
                style={{ background: diverging(v, max) }}
                onPointerEnter={() => setHover({ r, c })}
                aria-label={`${rowLabel} ${rowFormat(r)}, ${colLabel} ${colFormat(c)}: ${pct(v, 1)}`}
              >
                {pct(v, 0)}
              </div>
            );
          })}
        </div>
      ))}
      <div className="heat-foot small">
        {hover ? (
          <>
            {rowLabel} <b className="num">{rowFormat(hover.r)}</b>, {colLabel.toLowerCase()} <b className="num">{colFormat(hover.c)}</b>: median holder return{" "}
            <b className="num">{pct(value(hover.r, hover.c), 1)}</b> a year
          </>
        ) : (
          <>Hover a cell for details. The outlined cell is the current setting.</>
        )}
      </div>
    </div>
  );
}

/** Horizontal bars in one shared dollar scale, labelled directly. */
export function Bars({ rows }: { rows: { label: string; value: number; color: string; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="bars" onPointerLeave={() => setHover(null)}>
      {rows.map((r, i) => (
        <div key={r.label} className="bar-row" data-hover={hover === i} onPointerEnter={() => setHover(i)}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.max(0.4, (r.value / max) * 100).toFixed(2)}%`, background: r.color }} />
          </span>
          <span className="bar-value num">{usd(r.value)}</span>
          {hover === i && r.note && <span className="bar-note small">{r.note}</span>}
        </div>
      ))}
    </div>
  );
}
