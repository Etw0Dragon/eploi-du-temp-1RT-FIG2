import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CalendarCache } from "../src/cache.js";
import { buildApp } from "../src/server.js";

const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:one\nDTSTART:20260910T060000Z\nDTEND:20260910T080000Z\nSUMMARY:Architecture\nLOCATION:B01 - TD8\nEND:VEVENT\nEND:VCALENDAR";
const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "groups.json");

describe("API agenda", () => {
  it("n’expose que les groupes configurés et les événements normalisés", async () => {
    const app = await buildApp({ groupsPath: fixture, cache: new CalendarCache(async () => ics) });
    const groups = await app.inject({ method: "GET", url: "/api/groups" });
    expect(groups.json()).toEqual([{ id: "fi1g2", label: "R&T — FI1G2" }]);

    const schedule = await app.inject({ method: "GET", url: "/api/schedule?group=fi1g2&from=2026-09-10&to=2026-09-10" });
    expect(schedule.statusCode).toBe(200);
    expect(schedule.json().events[0]).toMatchObject({ title: "Architecture", location: "B01 - TD8" });
    expect(schedule.json()).not.toHaveProperty("fetchedAtMs");
    expect(schedule.headers["x-robots-tag"]).toContain("noindex");
    const page = await app.inject({ method: "GET", url: "/" });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Navigation de l'emploi du temps");
    await app.close();
  });

  it("rejette les paramètres hors périmètre et les groupes inconnus", async () => {
    const app = await buildApp({ groupsPath: fixture, cache: new CalendarCache(async () => ics) });
    const unknown = await app.inject({ method: "GET", url: "/api/schedule?group=https%3A%2F%2Fevil.test%2Ffeed&from=2026-09-10&to=2026-09-10" });
    const tooWide = await app.inject({ method: "GET", url: "/api/schedule?group=fi1g2&from=2026-01-01&to=2026-03-01" });
    expect(unknown.statusCode).toBe(404);
    expect(tooWide.statusCode).toBe(400);
    await app.close();
  });
});
