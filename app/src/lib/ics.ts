// Upcoming dividend and lock-up dates as an iCalendar (RFC 5545) file.

import type { Company, Pool, Raise, Terms } from "./chain";
import { SITE_DOMAIN } from "./config";

export type CalendarHolding = {
  listing: { raise: Pick<Raise, "id"> & { terms: Pick<Terms, "lockup_until"> }; company: Pick<Company, "name" | "period_secs"> };
  pool: Pick<Pool, "period" | "last_distribution">;
};

export type CalendarEvent = {
  uid: string;
  title: string;
  description: string;
  url: string;
  /** Unix seconds. */
  at: number;
  /** Expected period ends are a day, not a moment: the period ends when the company pays. */
  allDay: boolean;
};

const PERIODS_AHEAD = 4;

/**
 * The next expected period ends of each holding (a period runs from one payout to the next,
 * so they are counted from the last payout), and its lock-up end while it is still ahead.
 */
export function upcomingEvents(holdings: CalendarHolding[], now = Date.now() / 1000): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const { listing, pool } of holdings) {
    const { raise, company } = listing;
    const url = `https://${SITE_DOMAIN}/raise/${raise.id}`;
    const last = Number(pool.last_distribution);
    const period = Number(company.period_secs);
    if (last > 0 && period > 0) {
      const first = Math.max(1, Math.floor((now - last) / period) + 1);
      for (let k = first; k < first + PERIODS_AHEAD; k++) {
        events.push({
          uid: `period-${raise.id}-${pool.period + k - 1}@${SITE_DOMAIN}`,
          title: `Expected dividend: ${company.name}`,
          description: `The dividend period ends when ${company.name} pays its share of profit in USDC. Tokens locked for the whole period share it.`,
          url,
          at: last + k * period,
          allDay: true,
        });
      }
    }
    const lockup = Number(raise.terms.lockup_until);
    if (lockup > now) {
      events.push({
        uid: `lockup-${raise.id}@${SITE_DOMAIN}`,
        title: `Lock-up ends: ${company.name}`,
        description: `Your ${company.name} tokens can be released from lock-up and traded.`,
        url,
        at: lockup,
        allDay: false,
      });
    }
  }
  return events.sort((a, b) => a.at - b.at);
}

const stamp = (secs: number) => new Date(secs * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (secs: number) => stamp(secs).slice(0, 8);
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const utf8 = new TextEncoder();

/** Lines longer than 75 octets continue on the next line after a space, never inside a character. */
function fold(line: string): string {
  const parts: string[] = [];
  let part = "";
  let size = 0;
  for (const ch of line) {
    const n = utf8.encode(ch).length;
    if (size + n > 75) {
      parts.push(part);
      part = " ";
      size = 1;
    }
    part += ch;
    size += n;
  }
  parts.push(part);
  return parts.join("\r\n");
}

export function toIcs(events: CalendarEvent[], now = Date.now() / 1000): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//dvdnd//Portfolio//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:dvdnd dividends"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      ...(e.allDay
        ? [`DTSTART;VALUE=DATE:${day(e.at)}`, `DTEND;VALUE=DATE:${day(e.at + 86400)}`]
        : [`DTSTART:${stamp(e.at)}`, `DTEND:${stamp(e.at + 1800)}`]),
      `SUMMARY:${text(e.title)}`,
      `DESCRIPTION:${text(`${e.description}\n${e.url}`)}`,
      `URL:${e.url}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
