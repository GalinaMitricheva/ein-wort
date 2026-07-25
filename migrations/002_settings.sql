-- App settings as key/value. Single-user, so this holds a handful of rows —
-- the active CEFR level to start with (ui.md screens 9, 10) and future prefs.

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
