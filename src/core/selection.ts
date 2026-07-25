import type { Store, WordRow, Level } from "./store.ts";
import { SCHEMA_VERSION } from "./dossier/schema.ts";

// The selection engine (architecture.md §4). The base rule: highest-frequency
// word at the active level that is neither known nor already offered and has a
// built dossier at the current schema version. Phase 3 layers queued captures on
// top, so they outrank frequency order.
export function selectNextWord(store: Store, level: Level): WordRow | undefined {
  return store.nextSeedWord(level, SCHEMA_VERSION);
}
