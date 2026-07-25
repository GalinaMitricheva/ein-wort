import type { FastifyInstance } from "fastify";
import type { Store, Level, Calibration } from "../core/store.ts";
import type { DossierSource } from "../core/dossier/index.ts";
import { selectNextWord } from "../core/selection.ts";
import { toggleCapture, captureDisplay } from "../core/capture.ts";
import { layout } from "../views/layout.ts";
import {
  offerScreen,
  dossierScreen,
  sessionCompleteScreen,
  levelExhaustedScreen,
  firstRunScreen,
  levelSelectorScreen,
  logScreen,
  trayInner,
  type LogEntry,
} from "../views/screens.ts";

const LEVELS: readonly Level[] = ["B1", "B2", "C1"];
const isLevel = (v: unknown): v is Level => typeof v === "string" && LEVELS.includes(v as Level);
const CALS: readonly Calibration[] = ["know-it", "vaguely", "new"];
const isCal = (v: unknown): v is Calibration => typeof v === "string" && CALS.includes(v as Calibration);

// The whole app is server-rendered pages driven by plain form POSTs with 303
// redirects (Post/Redirect/Get), so a reload never re-submits and never consumes
// a fresh word. The core loop (ui.md): first-run → offer/calibrate → dossier → done.
export function registerRoutes(app: FastifyInstance, store: Store, dossiers: DossierSource): void {
  const html = (body: string, title?: string): string => layout({ body, title });

  // Main entry: resume an open session, else offer the next word.
  app.get("/", async (_req, reply) => {
    const level = store.getActiveLevel();
    if (!level) return reply.type("text/html").send(html(firstRunScreen()));

    const open = store.currentOpenSession();
    if (open) {
      const word = store.getWord(open.word_id)!;
      if (open.calibration === null) {
        return reply.type("text/html").send(html(offerScreen(word, open.id, level)));
      }
      const dossier = await dossiers.get({ id: word.id, lemma: word.lemma, pos: word.pos });
      if (dossier) {
        const caps = store.sessionActiveCaptures(open.id);
        const marked = new Set(caps.map((c) => c.surface_form));
        const tray = caps.map((c) => captureDisplay(store, c));
        return reply.type("text/html").send(html(dossierScreen(word, dossier, open.id, marked, tray)));
      }
      // No dossier built yet (shouldn't happen on fixtures): close the session, move on.
      store.completeSession(open.id);
    }

    const next = selectNextWord(store, level);
    if (!next) return reply.type("text/html").send(html(levelExhaustedScreen(level)));
    const sessionId = store.startSession(next.id);
    return reply.type("text/html").send(html(offerScreen(next, sessionId, level)));
  });

  // Calibrate: "Kenne ich" completes and moves on; "Vage"/"Neu" proceed to the dossier.
  app.post<{ Params: { id: string }; Body: { answer?: string } }>(
    "/session/:id/calibrate",
    async (req, reply) => {
      const id = Number(req.params.id);
      const session = store.getSession(id);
      if (!session || session.completed_at) return reply.redirect("/", 303);

      const answer = req.body.answer;
      if (!isCal(answer)) return reply.redirect("/", 303);

      store.setCalibration(id, answer);
      if (answer === "know-it") {
        store.markKnown(session.word_id, "know-it");
        store.completeSession(id);
      }
      return reply.redirect("/", 303); // → next word, or the dossier for this one
    },
  );

  // Word capture: tapping a word in the dossier toggles a pending capture and
  // returns the refreshed tray. The app only saves the tap (§5b) — no generation.
  app.post<{ Body: { surface?: unknown; session?: unknown } }>("/capture", async (req, reply) => {
    const surface = typeof req.body.surface === "string" ? req.body.surface.trim() : "";
    const sessionId = Number(req.body.session);
    if (!surface || !Number.isInteger(sessionId)) return reply.code(400).send({ error: "bad request" });
    const session = store.getSession(sessionId);
    if (!session) return reply.code(404).send({ error: "no such session" });

    const { marked } = toggleCapture(store, surface, sessionId);
    const caps = store.sessionActiveCaptures(sessionId);
    return reply.send({ marked, tray: trayInner(caps.map((c) => captureDisplay(store, c))) });
  });

  // "Weiter" on the dossier: the word lands in the log, session ends.
  app.post<{ Params: { id: string } }>("/session/:id/complete", async (req, reply) => {
    const id = Number(req.params.id);
    const session = store.getSession(id);
    if (!session || session.completed_at) return reply.redirect("/", 303);
    store.markKnown(session.word_id, "session-complete");
    store.completeSession(id);
    return reply.redirect("/done", 303);
  });

  // Session complete — a deliberate dead end (no "next word").
  app.get("/done", async (_req, reply) => {
    const met = store.recentMetWords(1);
    if (!met.length) return reply.redirect("/", 303);
    return reply.type("text/html").send(html(sessionCompleteScreen(met[0]!.word)));
  });

  // Level: first-run and the selector both POST here.
  app.post<{ Body: { level?: string } }>("/level", async (req, reply) => {
    if (isLevel(req.body.level)) store.setActiveLevel(req.body.level);
    return reply.redirect("/", 303);
  });

  app.get("/settings", async (_req, reply) => {
    const level = store.getActiveLevel() ?? "B2";
    return reply.type("text/html").send(html(levelSelectorScreen(level)));
  });

  // Minimal "Words met" log (search and capture taps arrive later).
  app.get("/log", async (_req, reply) => {
    const met = store.recentMetWords(3);
    const entries: LogEntry[] = await Promise.all(
      met.map(async ({ word }) => {
        const d = await dossiers.get({ id: word.id, lemma: word.lemma, pos: word.pos });
        return { word, meaning_de: d?.meaning_de ?? "" };
      }),
    );
    return reply.type("text/html").send(html(logScreen(entries, store.countPendingCaptures())));
  });
}
