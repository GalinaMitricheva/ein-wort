import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Fastify from "fastify";
import { loadConfig } from "./config.ts";
import { layout } from "./views/layout.ts";

const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();

// Vendored htmx, read once at boot. Serving this single asset via an explicit
// route avoids a static-file dependency (and its path-traversal advisories) —
// there is exactly one file to serve and no user-supplied path reaches disk.
const htmx = readFileSync(
  join(here, "..", "node_modules", "htmx.org", "dist", "htmx.min.js"),
);

const app = Fastify({ logger: true });

app.get("/vendor/htmx.min.js", async (_request, reply) => {
  reply.type("application/javascript").send(htmx);
});

// Liveness probe. The phone hits this over the tailnet to tell "laptop asleep"
// (no response) from "app broken" (error).
app.get("/health", async () => ({ status: "ok" }));

app.get("/", async (_request, reply) => {
  reply.type("text/html").send(
    layout({
      body: "    <p>Ein Wort — scaffold. The core loop arrives in phase 2.</p>",
    }),
  );
});

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
