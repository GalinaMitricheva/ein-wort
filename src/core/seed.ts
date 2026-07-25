import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Store, Level } from "./store.ts";
import { Dossier } from "./dossier/schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PATH = join(here, "..", "..", "data", "words.fixture.json");
export const DOSSIERS_PATH = join(here, "..", "..", "data", "dossiers.seed.json");

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

/** Load the hand-entered fixture (plan.md 1.4) into the words table. Idempotent. */
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
