import type { Store, WordRow, Level } from "./store.ts";

// The selection engine (architecture.md §4). For now this is the base rule:
// highest-frequency word at the active level that is neither known nor already
// offered. Phase 3 layers queued captures on top, so they outrank frequency order.
export function selectNextWord(store: Store, level: Level): WordRow | undefined {
  return store.nextSeedWord(level);
}
