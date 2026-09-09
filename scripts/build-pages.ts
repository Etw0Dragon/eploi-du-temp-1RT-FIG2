import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseIcs } from "../src/ics.ts";

const sourceUrl = process.env.ADE_ICS_URL;
const groupId = process.env.ADE_GROUP_ID ?? "fi1g2";
const groupLabel = process.env.ADE_GROUP_LABEL ?? "R&T — FI1G2";
const destination = path.resolve("site");

if (!sourceUrl) throw new Error("ADE_ICS_URL est requis. Ajoute-le comme secret GitHub Actions.");
if (new URL(sourceUrl).protocol !== "https:") throw new Error("ADE_ICS_URL doit utiliser HTTPS.");

const response = await fetch(sourceUrl, { headers: { accept: "text/calendar" } });
if (!response.ok) throw new Error(`ADE a répondu ${response.status}.`);
const content = await response.text();
const events = parseIcs(content);
if (!events.length) throw new Error("ADE a renvoyé un calendrier vide. Vérifie le secret ADE_ICS_URL.");
const updatedAt = new Date().toISOString();

await rm(destination, { recursive: true, force: true });
await cp(path.resolve("public"), destination, { recursive: true });
await writeFile(path.join(destination, ".nojekyll"), "");
await mkdir(path.join(destination, "data"), { recursive: true });
await writeFile(path.join(destination, "data", "groups.json"), JSON.stringify([{ id: groupId, label: groupLabel }], null, 2));
await writeFile(path.join(destination, "data", "schedule.json"), JSON.stringify({ updatedAt, events }));
console.log(`GitHub Pages généré : ${events.length} événements.`);
