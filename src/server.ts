import path from "node:path";
import { fileURLToPath } from "node:url";
import fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import { CalendarCache, UpstreamCalendarError } from "./cache.js";
import { loadGroups } from "./config.js";
import { eventsForRange } from "./ics.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const querySchema = z.object({
  group: z.string().min(1),
  from: z.string().regex(datePattern),
  to: z.string().regex(datePattern)
});

export type AppOptions = { groupsPath?: string; cache?: CalendarCache; publicPath?: string };

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({ logger: true });
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const groupsPath = options.groupsPath ?? process.env.GROUPS_CONFIG ?? path.join(projectRoot, "config", "groups.json");
  const publicPath = options.publicPath ?? path.join(projectRoot, "public");
  const cache = options.cache ?? new CalendarCache();
  let configError: string | undefined;
  let groups: ReturnType<typeof loadGroups> = [];
  try {
    groups = loadGroups(groupsPath);
  } catch (error) {
    configError = error instanceof Error ? error.message : "Configuration indisponible.";
    app.log.warn(configError);
  }

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
    reply.header("X-Robots-Tag", "noindex, nofollow, noarchive");
    reply.header("Content-Security-Policy", "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    return payload;
  });

  app.get("/healthz", async (_request, reply) => {
    if (configError) return reply.code(503).send({ ok: false, config: "invalid" });
    return { ok: true };
  });

  app.get("/api/groups", async (_request, reply) => {
    if (configError) return reply.code(503).send({ error: "Configuration des groupes indisponible." });
    return groups.map(({ id, label }) => ({ id, label }));
  });

  // En développement, le navigateur reçoit seulement les deux valeurs publiques Supabase.
  app.get("/supabase-config.js", async (_request, reply) => {
    const url = process.env.SUPABASE_URL ?? "";
    const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
    const config = url && anonKey ? { url, anonKey } : { url: "", anonKey: "" };
    return reply.type("application/javascript; charset=utf-8").send(`window.EDT_SUPABASE = ${JSON.stringify(config)};`);
  });

  app.get("/api/schedule", async (request, reply) => {
    if (configError) return reply.code(503).send({ error: "Configuration des groupes indisponible." });
    const result = querySchema.safeParse(request.query);
    if (!result.success || result.data.to < result.data.from) return reply.code(400).send({ error: "Paramètres de période invalides." });
    const fromDate = new Date(`${result.data.from}T00:00:00Z`);
    const toDate = new Date(`${result.data.to}T00:00:00Z`);
    if (Number.isNaN(fromDate.valueOf()) || Number.isNaN(toDate.valueOf()) || (toDate.valueOf() - fromDate.valueOf()) / 86_400_000 > 31) {
      return reply.code(400).send({ error: "La période doit faire 32 jours maximum." });
    }
    const group = groups.find((item) => item.id === result.data.group);
    if (!group) return reply.code(404).send({ error: "Groupe introuvable." });
    try {
      const calendar = await cache.get(group);
      return {
        group: { id: group.id, label: group.label },
        events: eventsForRange(calendar.events, result.data.from, result.data.to),
        fetchedAt: calendar.fetchedAt,
        stale: calendar.stale
      };
    } catch (error) {
      request.log.warn(error, "ADE indisponible");
      return reply.code(error instanceof UpstreamCalendarError ? 502 : 500).send({ error: "L’emploi du temps ADE est temporairement indisponible." });
    }
  });

  await app.register(fastifyStatic, { root: publicPath, prefix: "/" });
  app.get("/", async (_request, reply) => reply.sendFile("index.html"));
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });
}
