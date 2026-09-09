import { describe, expect, it, vi } from "vitest";
import { CalendarCache } from "../src/cache.js";

const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:one\nDTSTART:20260910T060000Z\nDTEND:20260910T080000Z\nSUMMARY:Test\nEND:VEVENT\nEND:VCALENDAR";
const group = { id: "fi1g2", label: "FI1G2", icsUrl: "https://example.test/calendar.ics" };

describe("CalendarCache", () => {
  it("déduplique les requêtes et respecte le TTL", async () => {
    const fetcher = vi.fn(async () => ics);
    const cache = new CalendarCache(fetcher, () => 1_000, 60_000);
    await Promise.all([cache.get(group), cache.get(group)]);
    await cache.get(group);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("renvoie le dernier état connu en cas de panne", async () => {
    let shouldFail = false;
    const cache = new CalendarCache(async () => { if (shouldFail) throw new Error("offline"); return ics; }, (() => { let now = 0; return () => now += 61_000; })(), 60_000, 86_400_000);
    await cache.get(group);
    shouldFail = true;
    const result = await cache.get(group);
    expect(result.stale).toBe(true);
  });
});
