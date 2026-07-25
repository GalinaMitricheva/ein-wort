import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Store, Level } from "./store.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PATH = join(here, "..", "..", "data", "words.fixture.json");

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
