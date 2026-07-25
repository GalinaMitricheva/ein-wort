import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Store, Level } from "./store.ts";
import { Dossier } from "./dossier/schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const dataFile = (name: string): string => join(here, "..", "..", "data", name);

// Word lists and dossier files, loaded in order. Later files upsert over earlier
// ones by (lemma, pos) / lemma, so a word or dossier can be refined in a newer file.
export const WORD_FILES = [dataFile("words.fixture.json"), dataFile("words.c1.json")];
export const DOSSIER_FILES = [dataFile("dossiers.seed.json"), dataFile("dossiers.c1.json")];

// Back-compat single-file paths (used by tests).
export const FIXTURE_PATH = WORD_FILES[0]!;
export const DOSSIERS_PATH = DOSSIER_FILES[0]!;

interface FixtureWord {
  lemma: string;
  pos: string;
  article?: string;
  plural?: string;
  key_forms?: Record<string, string>;
  level: Level;
  frequency_rank?: number;
}

interface FixtureFile {
  list_version: string;
  source: string;
  words: FixtureWord[];
}

/** Load every word list into the words table, in order. Idempotent. */
export function seedAllWords(store: Store): number {
  return WORD_FILES.reduce((n, path) => n + seedWordsFromFixture(store, path), 0);
}

/** Load every dossier file, aggregating counts and skips. Idempotent. */
export function seedAllDossiers(store: Store): DossierSeedResult {
  const out: DossierSeedResult = { loaded: 0, skipped: [] };
  for (const path of DOSSIER_FILES) {
    const r = seedDossiersFromFile(store, path);
    out.loaded += r.loaded;
    out.skipped.push(...r.skipped);
  }
  return out;
}

/** Load one hand-entered word list into the words table. Idempotent. */
export function seedWordsFromFixture(store: Store, path: string = FIXTURE_PATH): number {
  const data = JSON.parse(readFileSync(path, "utf8")) as FixtureFile;
  for (const w of data.words) {
    store.upsertWord({
      lemma: w.lemma,
      pos: w.pos,
      article: w.article ?? null,
      plural: w.plural ?? null,
      key_forms: w.key_forms ? JSON.stringify(w.key_forms) : null,
      level: w.level,
      source: data.source,
      frequency_rank: w.frequency_rank ?? null,
      list_version: data.list_version,
    });
  }
  return data.words.length;
}

interface DossiersFile {
  schema_version: number;
  model: string;
  dossiers: Record<string, unknown>;
}

export interface DossierSeedResult {
  loaded: number;
  skipped: string[];
}

/**
 * Load hand-authored dossiers into the dossiers table (the collection task's
 * output). Each entry is validated against the schema before it's stored, and
 * matched to a word by lemma; misses are reported, not silently dropped.
 */
export function seedDossiersFromFile(store: Store, path: string = DOSSIERS_PATH): DossierSeedResult {
  const data = JSON.parse(readFileSync(path, "utf8")) as DossiersFile;
  const skipped: string[] = [];
  let loaded = 0;
  for (const [lemma, raw] of Object.entries(data.dossiers)) {
    const word = store.findWordByLemma(lemma);
    if (!word) {
      skipped.push(`${lemma} — no matching word`);
      continue;
    }
    const parsed = Dossier.safeParse(raw);
    if (!parsed.success) {
      skipped.push(`${lemma} — invalid: ${parsed.error.issues[0]?.message ?? "schema"}`);
      continue;
    }
    store.upsertDossier(word.id, data.schema_version, data.model, JSON.stringify(parsed.data));
    loaded++;
  }
  return { loaded, skipped };
}
