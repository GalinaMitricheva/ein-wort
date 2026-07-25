import type { Db } from "./db.ts";

// Typed data access over the SQLite schema (migrations/001_init.sql). One place
// that knows SQL; the rest of the app calls these methods. better-sqlite3 caches
// prepared statements by SQL text, so preparing per call is cheap and keeps the
// code readable.

export type Level = "B1" | "B2" | "C1";
export type Calibration = "know-it" | "vaguely" | "new";
export type KnownVia = "know-it" | "session-complete";
export type CaptureStatus = "pending" | "resolved" | "queued" | "offered" | "dismissed";

export interface WordRow {
  id: number;
  lemma: string;
  pos: string;
  article: string | null;
  plural: string | null;
  key_forms: string | null; // JSON string, verbs only
  level: Level;
  source: string;
  frequency_rank: number | null;
  list_version: string;
}

export interface WordInput {
  lemma: string;
  pos: string;
  article?: string | null;
  plural?: string | null;
  key_forms?: string | null;
  level: Level;
  source: string;
  frequency_rank?: number | null;
  list_version: string;
}

export interface MetWord {
  word: WordRow;
  last_completed: string;
}

export interface OpenSession {
  id: number;
  word_id: number;
  calibration: Calibration | null;
}

export interface SessionRow extends OpenSession {
  completed_at: string | null;
}

export interface CaptureRow {
  id: number;
  surface_form: string;
  lemma: string | null;
  word_id: number | null;
  session_id: number | null;
  captured_at: string;
  status: CaptureStatus;
}

const now = (): string => new Date().toISOString();

/** The word as it's learned: nouns carry their gender (der/die/das + lemma). */
export function displayLemma(w: Pick<WordRow, "pos" | "article" | "lemma">): string {
  return w.pos === "noun" && w.article ? `${w.article} ${w.lemma}` : w.lemma;
}

export class Store {
  constructor(private readonly db: Db) {}

  // ── words ────────────────────────────────────────────────────────────────

  /** Insert or update by (lemma, pos). Used by the fixture and seed importers. */
  upsertWord(w: WordInput): number {
    const row = this.db
      .prepare(
        `INSERT INTO words (lemma, pos, article, plural, key_forms, level, source, frequency_rank, list_version)
         VALUES (@lemma, @pos, @article, @plural, @key_forms, @level, @source, @frequency_rank, @list_version)
         ON CONFLICT (lemma, pos) DO UPDATE SET
           article = excluded.article, plural = excluded.plural, key_forms = excluded.key_forms,
           level = excluded.level, source = excluded.source,
           frequency_rank = excluded.frequency_rank, list_version = excluded.list_version
         RETURNING id`,
      )
      .get({
        article: null,
        plural: null,
        key_forms: null,
        frequency_rank: null,
        ...w,
      }) as { id: number };
    return row.id;
  }

  getWord(id: number): WordRow | undefined {
    return this.db.prepare("SELECT * FROM words WHERE id = ?").get(id) as WordRow | undefined;
  }

  countWords(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM words").get() as { n: number }).n;
  }

  // ── selection ────────────────────────────────────────────────────────────

  /**
   * The base selection rule (architecture.md §4): the highest-frequency word at
   * `level` that is neither known nor already offered — and has a built dossier
   * (§5: a word with no dossier is simply not offered). Captured words that outrank
   * frequency order are layered on top by core/selection (Phase 3).
   */
  nextSeedWord(level: Level, schemaVersion: number): WordRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM words w
         WHERE w.level = ?
           AND w.id NOT IN (SELECT word_id FROM known_words)
           AND w.id NOT IN (SELECT word_id FROM sessions)
           AND EXISTS (SELECT 1 FROM dossiers d WHERE d.word_id = w.id AND d.schema_version = ?)
         ORDER BY (w.frequency_rank IS NULL), w.frequency_rank ASC, w.id ASC
         LIMIT 1`,
      )
      .get(level, schemaVersion) as WordRow | undefined;
  }

  // ── known_words ──────────────────────────────────────────────────────────

  markKnown(wordId: number, via: KnownVia): void {
    this.db
      .prepare(
        `INSERT INTO known_words (word_id, marked_at, via) VALUES (?, ?, ?)
         ON CONFLICT (word_id) DO UPDATE SET marked_at = excluded.marked_at, via = excluded.via`,
      )
      .run(wordId, now(), via);
  }

  /** Retraction (§5b): a re-captured word must leave known_words or it stays unreachable. */
  unmarkKnown(wordId: number): void {
    this.db.prepare("DELETE FROM known_words WHERE word_id = ?").run(wordId);
  }

  isKnown(wordId: number): boolean {
    return this.db.prepare("SELECT 1 FROM known_words WHERE word_id = ?").get(wordId) != null;
  }

  // ── sessions ─────────────────────────────────────────────────────────────

  /** A session row is created when a word is offered (marks it "already offered"). */
  startSession(wordId: number): number {
    const row = this.db
      .prepare("INSERT INTO sessions (word_id, started_at) VALUES (?, ?) RETURNING id")
      .get(wordId, now()) as { id: number };
    return row.id;
  }

  setCalibration(sessionId: number, calibration: Calibration): void {
    this.db.prepare("UPDATE sessions SET calibration = ? WHERE id = ?").run(calibration, sessionId);
  }

  completeSession(sessionId: number): void {
    this.db.prepare("UPDATE sessions SET completed_at = ? WHERE id = ?").run(now(), sessionId);
  }

  /**
   * The one in-progress session, if any — started but not completed. Used to
   * resume in place after the app is closed mid-loop (ui.md, "Session resumed"),
   * and to avoid consuming a fresh word on every page reload.
   */
  currentOpenSession(): OpenSession | undefined {
    return this.db
      .prepare(
        "SELECT id, word_id, calibration FROM sessions WHERE completed_at IS NULL ORDER BY id DESC LIMIT 1",
      )
      .get() as OpenSession | undefined;
  }

  getSession(id: number): SessionRow | undefined {
    return this.db
      .prepare("SELECT id, word_id, calibration, completed_at FROM sessions WHERE id = ?")
      .get(id) as SessionRow | undefined;
  }

  /** The "Words met" log: distinct words by most recent completed session (§5b, screen 6). */
  recentMetWords(limit: number): MetWord[] {
    const rows = this.db
      .prepare(
        `SELECT w.*, MAX(s.completed_at) AS last_completed
         FROM sessions s JOIN words w ON w.id = s.word_id
         WHERE s.completed_at IS NOT NULL
         GROUP BY w.id
         ORDER BY last_completed DESC
         LIMIT ?`,
      )
      .all(limit) as (WordRow & { last_completed: string })[];
    return rows.map(({ last_completed, ...word }) => ({ word, last_completed }));
  }

  // ── dossiers ─────────────────────────────────────────────────────────────

  /** The validated dossier JSON for a word at the current schema version, or null. */
  getDossierJson(wordId: number, schemaVersion: number): string | null {
    const row = this.db
      .prepare("SELECT json FROM dossiers WHERE word_id = ? AND schema_version = ?")
      .get(wordId, schemaVersion) as { json: string } | undefined;
    return row?.json ?? null;
  }

  countDossiers(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM dossiers").get() as { n: number }).n;
  }

  /** Word ids at a level that have no dossier at the given schema version — the
   *  collection task's worklist for seed words. */
  wordsMissingDossier(schemaVersion: number): WordRow[] {
    return this.db
      .prepare(
        `SELECT w.* FROM words w
         WHERE NOT EXISTS (
           SELECT 1 FROM dossiers d WHERE d.word_id = w.id AND d.schema_version = ?
         )
         ORDER BY w.level, w.frequency_rank`,
      )
      .all(schemaVersion) as WordRow[];
  }

  /** Written by the offline collection task after validating against the schema. */
  upsertDossier(wordId: number, schemaVersion: number, model: string, json: string): void {
    this.db
      .prepare(
        `INSERT INTO dossiers (word_id, schema_version, model, generated_at, json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (word_id) DO UPDATE SET
           schema_version = excluded.schema_version, model = excluded.model,
           generated_at = excluded.generated_at, json = excluded.json`,
      )
      .run(wordId, schemaVersion, model, now(), json);
  }

  // ── captures ─────────────────────────────────────────────────────────────

  /**
   * Save a tap (§5b) with whatever we could resolve. lemma/word_id are best-effort
   * for the tray and the eventual collection task; the app never generates anything.
   */
  insertCapture(input: {
    surfaceForm: string;
    lemma: string | null;
    wordId: number | null;
    sessionId: number | null;
  }): number {
    const row = this.db
      .prepare(
        `INSERT INTO captures (surface_form, lemma, word_id, session_id, captured_at, status)
         VALUES (?, ?, ?, ?, ?, 'pending') RETURNING id`,
      )
      .get(input.surfaceForm, input.lemma, input.wordId, input.sessionId, now()) as { id: number };
    return row.id;
  }

  deleteCapture(id: number): void {
    this.db.prepare("DELETE FROM captures WHERE id = ?").run(id);
  }

  /** The active capture matching a tap, for toggle (undo on re-tap). Keyed by lemma
   *  when resolved (respecting the unique index), else by surface form. */
  activeCapture(surface: string, lemma: string | null): CaptureRow | undefined {
    const active = "status IN ('pending', 'resolved', 'queued')";
    return lemma
      ? (this.db.prepare(`SELECT * FROM captures WHERE lemma = ? AND ${active}`).get(lemma) as
          | CaptureRow
          | undefined)
      : (this.db
          .prepare(`SELECT * FROM captures WHERE surface_form = ? AND lemma IS NULL AND ${active}`)
          .get(surface) as CaptureRow | undefined);
  }

  /** Active captures made during a session — drives the tray and the marked state. */
  sessionActiveCaptures(sessionId: number): CaptureRow[] {
    return this.db
      .prepare(
        "SELECT * FROM captures WHERE session_id = ? AND status IN ('pending', 'resolved', 'queued') ORDER BY id",
      )
      .all(sessionId) as CaptureRow[];
  }

  /** Exact-lemma lookup for capture resolution (tray display + word_id link). */
  findWordByLemma(lemma: string): WordRow | undefined {
    return this.db.prepare("SELECT * FROM words WHERE lemma = ? LIMIT 1").get(lemma) as
      | WordRow
      | undefined;
  }

  /** The collection task's worklist: captures awaiting processing. */
  pendingCaptures(): CaptureRow[] {
    return this.db
      .prepare("SELECT * FROM captures WHERE status = 'pending' ORDER BY id")
      .all() as CaptureRow[];
  }

  setCaptureStatus(id: number, status: CaptureStatus): void {
    this.db.prepare("UPDATE captures SET status = ? WHERE id = ?").run(status, id);
  }

  /** Record what the collection task resolved a capture to, and advance its status. */
  resolveCapture(id: number, lemma: string | null, wordId: number | null, status: CaptureStatus): void {
    this.db
      .prepare("UPDATE captures SET lemma = ?, word_id = ?, status = ? WHERE id = ?")
      .run(lemma, wordId, status, id);
  }

  /** The lemma of a session's offered word — for the self-tap check. */
  sessionWordLemma(sessionId: number): string | undefined {
    const row = this.db
      .prepare("SELECT w.lemma FROM sessions s JOIN words w ON w.id = s.word_id WHERE s.id = ?")
      .get(sessionId) as { lemma: string } | undefined;
    return row?.lemma;
  }

  /** Screen 6 diagnostic: only pending captures (those not yet collected). */
  countPendingCaptures(): number {
    return (
      this.db.prepare("SELECT COUNT(*) AS n FROM captures WHERE status = 'pending'").get() as {
        n: number;
      }
    ).n;
  }

  // ── settings ─────────────────────────────────────────────────────────────

  getSetting(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  /** The active CEFR level, or undefined before first run (ui.md screens 9, 10). */
  getActiveLevel(): Level | undefined {
    return this.getSetting("active_level") as Level | undefined;
  }

  setActiveLevel(level: Level): void {
    this.setSetting("active_level", level);
  }
}
