import { loadConfig } from "../config.ts";
import { openMigrated } from "./db.ts";
import { Store } from "./store.ts";
import { seedAllWords, seedAllDossiers } from "./seed.ts";

// Open the migrated database and return a ready store. In development the
// hand-entered word fixture (plan.md 1.4) and the hand-authored dossiers (the
// collection task's output) are loaded when their tables are empty, so the app
// has real content to run on before the composite word list exists (Phase 5).

export interface Bootstrap {
  store: Store;
  seededWords: number;
  seededDossiers: number;
  skippedDossiers: string[];
}

export function bootstrapStore(): Bootstrap {
  const { dbFile } = loadConfig();
  const db = openMigrated(dbFile);
  const store = new Store(db);

  const seededWords = store.countWords() === 0 ? seedAllWords(store) : 0;
  const dossierSeed =
    store.countDossiers() === 0 ? seedAllDossiers(store) : { loaded: 0, skipped: [] as string[] };

  return {
    store,
    seededWords,
    seededDossiers: dossierSeed.loaded,
    skippedDossiers: dossierSeed.skipped,
  };
}
