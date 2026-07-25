import { loadConfig } from "../config.ts";
import { openMigrated } from "./db.ts";
import { Store } from "./store.ts";
import { seedWordsFromFixture } from "./seed.ts";

// Open the migrated database and return a ready store. In development the
// hand-entered fixture (plan.md 1.4) is loaded when the words table is empty,
// so the app has content to run on before the real word list exists (Phase 5).

export interface Bootstrap {
  store: Store;
  seeded: number;
}

export function bootstrapStore(): Bootstrap {
  const { dbFile } = loadConfig();
  const db = openMigrated(dbFile);
  const store = new Store(db);
  const seeded = store.countWords() === 0 ? seedWordsFromFixture(store) : 0;
  return { store, seeded };
}
