import crypto from "node:crypto";
import type { ScheduleEvent } from "./types.js";

type RawEvent = Record<string, string>;

function unfold(content: string): string[] {
  return content.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function unescapeIcs(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function readDate(value: string): { date: Date; allDay: boolean } | null {
  const compact = value.trim();
  const allDay = /^\d{8}$/.test(compact);
  const match = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  return Number.isNaN(date.valueOf()) ? null : { date, allDay };
}

function cleanDetails(value: string | undefined): string[] {
  if (!value) return [];
  return unescapeIcs(value)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^\(Updated\s*:/i.test(line));
}

export function parseIcs(content: string): ScheduleEvent[] {
  if (!/BEGIN:VCALENDAR/i.test(content)) throw new Error("La réponse ADE n’est pas un calendrier ICS.");
  const events: RawEvent[] = [];
  let current: RawEvent | undefined;

  for (const line of unfold(content)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = undefined;
      continue;
    }
    if (!current) continue;
    const match = line.match(/^([A-Z-]+)(?:;[^:]*)?:(.*)$/i);
    if (match) current[match[1].toUpperCase()] = match[2];
  }

  return events.flatMap((event) => {
    const start = readDate(event.DTSTART ?? "");
    const end = readDate(event.DTEND ?? "");
    const title = event.SUMMARY ? unescapeIcs(event.SUMMARY).trim() : "Cours sans intitulé";
    if (!start || !end || end.date <= start.date) return [];
    const id = event.UID ? unescapeIcs(event.UID) : crypto.createHash("sha256").update(`${title}:${start.date.toISOString()}`).digest("hex").slice(0, 16);
    const location = event.LOCATION ? unescapeIcs(event.LOCATION).trim() || null : null;
    return [{
      id,
      title,
      startsAt: start.date.toISOString(),
      endsAt: end.date.toISOString(),
      location,
      details: cleanDetails(event.DESCRIPTION),
      allDay: start.allDay
    }];
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function parisDate(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(isoDate));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function eventsForRange(events: ScheduleEvent[], from: string, to: string): ScheduleEvent[] {
  return events.filter((event) => parisDate(event.startsAt) <= to && parisDate(event.endsAt) >= from);
}
