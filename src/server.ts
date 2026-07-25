import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Fastify from "fastify";
import formbody from "@fastify/formbody";
import { loadConfig } from "./config.ts";
import { bootstrapStore } from "./core/bootstrap.ts";
import { getDossierSource } from "./core/dossier/index.ts";
import { registerRoutes } from "./adapters/http.ts";

const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const { store, seeded } = bootstrapStore();
const dossiers = getDossierSource();

// Vendored htmx, read once at boot. Serving this single asset via an explicit
// route avoids a static-file dependency (and its path-traversal advisories) —
// there is exactly one file to serve and no user-supplied path reaches disk.
const htmx = readFileSync(
  join(here, "..", "node_modules", "htmx.org", "dist", "htmx.min.js"),
);

const app = Fastify({ logger: true });
app.log.info({ words: store.countWords(), seeded, dossiers: dossiers.kind }, "data layer ready");

await app.register(formbody); // parse application/x-www-form-urlencoded form posts

app.get("/vendor/htmx.min.js", async (_request, reply) => {
  reply.type("application/javascript").send(htmx);
});

// Liveness probe. The phone hits this over the tailnet to tell "laptop asleep"
// (no response) from "app broken" (error).
app.get("/health", async () => ({ status: "ok" }));

registerRoutes(app, store, dossiers);

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
