import type { DossierSource } from "./source.ts";
import { FixtureDossierSource } from "./fixture.ts";

export type { DossierSource, WordInput } from "./source.ts";
export { Dossier, Register } from "./schema.ts";

// The app reads dossiers through this. Fixtures in development; the stored,
// SQLite-backed source arrives with the data layer (Phase 1/3). Neither touches
// the network — the app makes no model calls (architecture.md §7b).
export function getDossierSource(): DossierSource {
  return new FixtureDossierSource();
}
