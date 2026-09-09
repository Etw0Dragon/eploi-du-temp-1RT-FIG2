import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadGroups } from "../src/config.ts";
import { parseIcs } from "../src/ics.ts";

// En local, on réutilise le fichier privé ignoré par Git.
const localGroup = process.env.ADE_ICS_URL ? undefined : loadGroups("config/groups.json")[0];
const sourceUrl = process.env.ADE_ICS_URL ?? localGroup?.icsUrl;
const groupId = process.env.ADE_GROUP_ID ?? localGroup?.id ?? "fi1g2";
const groupLabel = process.env.ADE_GROUP_LABEL ?? localGroup?.label ?? "R&T — FI1G2";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const destination = path.resolve("site");

if (!sourceUrl) throw new Error("Ajoute ADE_ICS_URL dans GitHub Actions ou crée config/groups.json en local.");
if (new URL(sourceUrl).protocol !== "https:") throw new Error("ADE_ICS_URL doit utiliser HTTPS.");
if (Boolean(supabaseUrl) !== Boolean(supabaseAnonKey)) throw new Error("SUPABASE_URL et SUPABASE_ANON_KEY doivent être définis ensemble.");
if (supabaseUrl && new URL(supabaseUrl).protocol !== "https:") throw new Error("SUPABASE_URL doit utiliser HTTPS.");

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
if (supabaseUrl && supabaseAnonKey) {
  const config = `window.EDT_SUPABASE = ${JSON.stringify({ url: supabaseUrl, anonKey: supabaseAnonKey })};\n`;
  await writeFile(path.join(destination, "supabase-config.js"), config);
}
console.log(`GitHub Pages généré : ${events.length} événements.`);
