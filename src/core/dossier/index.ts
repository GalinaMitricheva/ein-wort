import type { Store } from "../store.ts";
import type { DossierSource } from "./source.ts";
import { StoredDossierSource } from "./stored.ts";

export type { DossierSource, WordInput } from "./source.ts";
export { Dossier, Register, SCHEMA_VERSION } from "./schema.ts";
export { FixtureDossierSource } from "./fixture.ts";
export { StoredDossierSource } from "./stored.ts";

// The app reads real dossiers from the store — built offline by the collection
// task and seeded on boot. FixtureDossierSource stays available for tests that
// run without a database.
export function getDossierSource(store: Store): DossierSource {
  return new StoredDossierSource(store);
}
