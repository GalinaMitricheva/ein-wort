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

// Liveness probe. Deliberately credential-free: the phone hits this over the
// tailnet to tell "laptop asleep" (no response) from "app broken" (error). No
// model call happens here, so it must work whether or not a token is set.
app.get("/health", async () => ({
  status: "ok",
  credential: config.hasCredential ? "present" : "missing",
}));

app.get("/", async (_request, reply) => {
  reply.type("text/html").send(
    layout({
      body: "    <p>Ein Wort — scaffold. The core loop arrives in phase 2.</p>",
    }),
  );
});

if (!config.hasCredential) {
  // A warning now, not a hard failure: phase 0 makes no model calls. Once the
  // loop exists this becomes fatal at startup (architecture.md 7b, trap 3) so a
  // missing token never surfaces as a confusing 401 mid-session.
  app.log.warn(
    "No Anthropic credential found. Run `claude setup-token` and set " +
      "ANTHROPIC_AUTH_TOKEN in .env before phase 3. Model calls will fail until then.",
  );
}

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
