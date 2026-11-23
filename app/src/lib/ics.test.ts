import { describe, expect, it } from "vitest";
import { toIcs, upcomingEvents, type CalendarHolding } from "./ics";

const t = (iso: string) => Date.parse(iso) / 1000;
const NOW = t("2026-11-24T00:00:00Z");
const QUARTER = 7_884_000n;

function holding(o: { id: number; name: string; period?: bigint; period_no?: number; last?: string; lockup: string }): CalendarHolding {
  return {
    listing: { raise: { id: o.id, terms: { lockup_until: BigInt(t(o.lockup)) } }, company: { name: o.name, period_secs: o.period ?? QUARTER } },
    pool: { period: o.period_no ?? 2, last_distribution: o.last ? BigInt(t(o.last)) : 0n },
  };
}

const lumen = holding({ id: 9, name: "Lumen Coffee Roasters", last: "2026-10-26T01:06:17Z", lockup: "2026-10-26T01:13:07Z" });
const northline = holding({ id: 4, name: "Northline Fitness", period: 31_536_000n, period_no: 0, lockup: "2027-11-01T20:36:14Z" });

describe("upcomingEvents", () => {
  it("counts the next four period ends from the last payout", () => {
    const events = upcomingEvents([lumen], NOW);
    expect(events.map((e) => new Date(e.at * 1000).toISOString())).toEqual([
      "2027-01-25T07:06:17.000Z",
      "2027-04-26T13:06:17.000Z",
      "2027-07-26T19:06:17.000Z",
      "2027-10-26T01:06:17.000Z",
    ]);
    expect(events.map((e) => e.uid)).toEqual(["period-9-2@dvdnd.app", "period-9-3@dvdnd.app", "period-9-4@dvdnd.app", "period-9-5@dvdnd.app"]);
    expect(events.every((e) => e.allDay && e.title === "Expected dividend: Lumen Coffee Roasters")).toBe(true);
  });

  it("skips period ends a late payout has already passed", () => {
    const [next] = upcomingEvents([lumen], t("2027-02-10T00:00:00Z"));
    expect(new Date(next.at * 1000).toISOString()).toBe("2027-04-26T13:06:17.000Z");
    expect(next.uid).toBe("period-9-3@dvdnd.app");
  });

  it("has no period ends before the first payout, and the lock-up end only while it is ahead", () => {
    expect(upcomingEvents([northline], NOW)).toEqual([
      expect.objectContaining({ uid: "lockup-4@dvdnd.app", title: "Lock-up ends: Northline Fitness", at: t("2027-11-01T20:36:14Z"), allDay: false }),
    ]);
    expect(upcomingEvents([northline], t("2027-12-01T00:00:00Z"))).toEqual([]);
  });

  it("orders every holding's dates together", () => {
    const at = upcomingEvents([northline, lumen], NOW).map((e) => e.at);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at).toHaveLength(5);
  });
});

describe("toIcs", () => {
  const ics = toIcs(upcomingEvents([lumen, northline], NOW), NOW);
  const lines = ics.split("\r\n");

  it("is one VCALENDAR with CRLF line endings", () => {
    expect(lines.slice(0, 3)).toEqual(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//dvdnd//Portfolio//EN"]);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(5);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(5);
    expect(lines.filter((l) => l === "DTSTAMP:20261124T000000Z")).toHaveLength(5);
  });

  it("writes period ends as all-day dates and the lock-up end as a UTC time", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20270125\r\nDTEND;VALUE=DATE:20270126\r\n");
    expect(ics).toContain("DTSTART:20271101T203614Z\r\nDTEND:20271101T210614Z\r\n");
    expect(ics).toContain("URL:https://dvdnd.app/raise/9\r\n");
  });

  it("escapes text and folds long lines at 75 octets without splitting a character", () => {
    const name = "Café Ñandú, Lisboa; Porto \\ Braga ☕ ".repeat(3);
    const out = toIcs(upcomingEvents([holding({ id: 1, name, period_no: 0, lockup: "2027-01-01T00:00:00Z" })], NOW), NOW);
    const raw = out.split("\r\n");
    expect(raw.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    const summary = out.replace(/\r\n /g, "").split("\r\n").find((l) => l.startsWith("SUMMARY:"));
    expect(summary).toBe(`SUMMARY:Lock-up ends: ${name.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")}`);
    expect(out).not.toContain("\uFFFD");
  });

  it("is a valid empty calendar with no holdings", () => {
    expect(toIcs([], NOW)).not.toContain("VEVENT");
    expect(toIcs([], NOW).endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
