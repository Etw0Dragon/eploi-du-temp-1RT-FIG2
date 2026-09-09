import { describe, expect, it } from "vitest";
import { eventsForRange, parseIcs, parisDate } from "../src/ics.js";

const calendar = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:demo\r\nDTSTART:20260910T060000Z\r\nDTEND:20260910T080000Z\r\nSUMMARY:R106 Architecture\\, TD G2\r\nLOCATION:B01 - TD8 (033)\r\nDESCRIPTION:FI1G2\\nPIEL Marie\\n(Updated :01/09/2026)\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

describe("parseIcs", () => {
  it("normalise les informations ADE", () => {
    const [event] = parseIcs(calendar);
    expect(event.title).toBe("R106 Architecture, TD G2");
    expect(event.location).toBe("B01 - TD8 (033)");
    expect(event.details).toEqual(["FI1G2", "PIEL Marie"]);
    expect(parisDate(event.startsAt)).toBe("2026-09-10");
  });

  it("filtre une période avec la date Paris", () => {
    const events = parseIcs(calendar);
    expect(eventsForRange(events, "2026-09-10", "2026-09-10")).toHaveLength(1);
    expect(eventsForRange(events, "2026-09-11", "2026-09-11")).toHaveLength(0);
  });
});
