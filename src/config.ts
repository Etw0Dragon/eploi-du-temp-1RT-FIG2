import { readFileSync } from "node:fs";
import { z } from "zod";
import type { CalendarGroup } from "./types.js";

const groupSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),
  label: z.string().min(1).max(80),
  icsUrl: z.string().url().refine((value) => new URL(value).protocol === "https:", "Le lien ICS doit utiliser HTTPS.")
});

const groupsSchema = z.array(groupSchema).min(1).max(40).superRefine((groups, context) => {
  const ids = new Set<string>();
  for (const [index, group] of groups.entries()) {
    if (ids.has(group.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Les identifiants de groupe doivent être uniques.", path: [index, "id"] });
    ids.add(group.id);
  }
});

export function loadGroups(filePath: string): CalendarGroup[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Configuration des groupes introuvable ou invalide (${filePath}).`, { cause: error });
  }
  return groupsSchema.parse(raw);
}
