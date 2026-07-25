import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, "..", "..", "migrations");

export type Db = Database.Database;

/** Open a connection with the pragmas this app relies on. */
export function openDatabase(file: string): Db {
  const db = new Database(file);
  db.pragma("journal_mode = WAL"); // durable, and fine for a single writer
  db.pragma("foreign_keys = ON"); // REFERENCES are declared; enforce them
  db.pragma("busy_timeout = 5000");
  return db;
}

/**
 * Apply pending migrations in filename order, each in its own transaction.
 * Idempotent: already-applied files (tracked in schema_migrations) are skipped.
 * Returns the versions applied this call.
 */
export function migrate(db: Db): string[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((r) => (r as { version: string }).version),
  );
  const record = db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)");

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const newlyApplied: string[] = [];
  for (const version of files) {
    if (applied.has(version)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, version), "utf8");
    db.transaction(() => {
      db.exec(sql);
      record.run(version, new Date().toISOString());
    })();
    newlyApplied.push(version);
  }
  return newlyApplied;
}

/** Open and migrate in one step — the normal entry point. */
export function openMigrated(file: string): Db {
  const db = openDatabase(file);
  migrate(db);
  return db;
}
