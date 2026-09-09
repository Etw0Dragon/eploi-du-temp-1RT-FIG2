import { parseIcs } from "./ics.js";
import type { CalendarGroup, ScheduleEvent } from "./types.js";

export class UpstreamCalendarError extends Error {}

type Snapshot = { events: ScheduleEvent[]; fetchedAt: string; fetchedAtMs: number };
type FetchCalendar = (url: string) => Promise<string>;

export class CalendarCache {
  private snapshots = new Map<string, Snapshot>();
  private inFlight = new Map<string, Promise<Snapshot>>();

  constructor(
    private readonly fetchCalendar: FetchCalendar = requestCalendar,
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = 15 * 60_000,
    private readonly maxStaleMs = 24 * 60 * 60_000
  ) {}

  async get(group: CalendarGroup): Promise<{ events: ScheduleEvent[]; fetchedAt: string; stale: boolean }> {
    const existing = this.snapshots.get(group.id);
    if (existing && this.now() - existing.fetchedAtMs < this.ttlMs) return this.publicSnapshot(existing, false);
    try {
      const snapshot = await this.refresh(group);
      return this.publicSnapshot(snapshot, false);
    } catch (error) {
      if (existing && this.now() - existing.fetchedAtMs < this.maxStaleMs) return this.publicSnapshot(existing, true);
      throw error;
    }
  }

  private async refresh(group: CalendarGroup): Promise<Snapshot> {
    const pending = this.inFlight.get(group.id);
    if (pending) return pending;
    const request = this.fetchCalendar(group.icsUrl)
      .then((content) => {
        const fetchedAtMs = this.now();
        const snapshot = { events: parseIcs(content), fetchedAt: new Date(fetchedAtMs).toISOString(), fetchedAtMs };
        this.snapshots.set(group.id, snapshot);
        return snapshot;
      })
      .finally(() => this.inFlight.delete(group.id));
    this.inFlight.set(group.id, request);
    return request;
  }

  private publicSnapshot(snapshot: Snapshot, stale: boolean) {
    return { events: snapshot.events, fetchedAt: snapshot.fetchedAt, stale };
  }
}

async function requestCalendar(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "text/calendar" } });
    if (!response.ok) throw new UpstreamCalendarError(`ADE a répondu ${response.status}.`);
    const content = await response.text();
    if (content.length > 5_000_000) throw new UpstreamCalendarError("Le calendrier ADE est anormalement volumineux.");
    return content;
  } catch (error) {
    if (error instanceof UpstreamCalendarError) throw error;
    throw new UpstreamCalendarError("Impossible de joindre le calendrier ADE.", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
