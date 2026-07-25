-- Initial schema (architecture.md §3, as revised through the design reviews).
-- The anchor step is out of MVP scope, so `sessions` carries no anchor columns
-- and there is no feedback_disputes table.

CREATE TABLE words (
  id             INTEGER PRIMARY KEY,
  lemma          TEXT NOT NULL,
  pos            TEXT NOT NULL,                       -- noun | verb | adj | adv | ...
  article        TEXT,                                -- der/die/das, nouns only
  plural         TEXT,                                -- nouns only
  key_forms      TEXT,                                -- JSON, verbs only: principal parts for the offer screen
  level          TEXT NOT NULL CHECK (level IN ('B1', 'B2', 'C1')),
  source         TEXT NOT NULL,                       -- goethe-b1 | aspekte-b2 | telc-c1 | freq | capture | hand-fixture
  frequency_rank INTEGER,
  list_version   TEXT NOT NULL,                       -- level assignments are versioned like code (§5)
  UNIQUE (lemma, pos)
);

CREATE INDEX words_level_rank ON words (level, frequency_rank);

CREATE TABLE known_words (
  word_id   INTEGER PRIMARY KEY REFERENCES words(id),
  marked_at TEXT NOT NULL,
  via       TEXT NOT NULL CHECK (via IN ('know-it', 'session-complete'))
);

CREATE TABLE sessions (
  id           INTEGER PRIMARY KEY,
  word_id      INTEGER NOT NULL REFERENCES words(id),
  started_at   TEXT NOT NULL,
  completed_at TEXT,
  calibration  TEXT CHECK (calibration IN ('know-it', 'vaguely', 'new'))
);

-- The log lists distinct words by most recent session (retraction means a word
-- can have several completed sessions), so this index serves that ordering.
CREATE INDEX sessions_word_completed ON sessions (word_id, completed_at);

CREATE TABLE dossiers (
  word_id        INTEGER PRIMARY KEY REFERENCES words(id),
  schema_version INTEGER NOT NULL,
  model          TEXT NOT NULL,                       -- which model built it (offline task, §5b)
  generated_at   TEXT NOT NULL,
  json           TEXT NOT NULL,                       -- validated against the Dossier schema before write
  error_report   TEXT                                 -- §11 "report an error" affordance
);

CREATE TABLE captures (
  id           INTEGER PRIMARY KEY,
  surface_form TEXT NOT NULL,                         -- as tapped, e.g. "Vorschläge"
  lemma        TEXT,                                  -- resolved, e.g. "Vorschlag"
  word_id      INTEGER REFERENCES words(id),          -- NULL if not in the word list
  session_id   INTEGER REFERENCES sessions(id),
  captured_at  TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'resolved', 'queued', 'offered', 'dismissed'))
);

-- One active capture per lemma (architecture.md §5b): enforced in the schema,
-- not just in the collection task, so a race can't create duplicates.
CREATE UNIQUE INDEX captures_active_lemma
  ON captures (lemma)
  WHERE status IN ('pending', 'resolved', 'queued');
