import type { Store } from "../store.ts";
import type { DossierSource, WordInput } from "./source.ts";
import { Dossier, SCHEMA_VERSION } from "./schema.ts";

// The real dossier source: reads pre-built dossiers from the SQLite store
// (architecture.md §7b). Dossiers are written by the offline collection task;
// the app only ever reads. A word with no dossier at the current schema version
// returns null — the app doesn't offer it.

export class StoredDossierSource implements DossierSource {
  readonly kind = "stored" as const;

  constructor(private readonly store: Store) {}

  async get(word: WordInput): Promise<Dossier | null> {
    const id = word.id ?? this.store.findWordByLemma(word.lemma)?.id;
    if (id == null) return null;
    const json = this.store.getDossierJson(id, SCHEMA_VERSION);
    if (json == null) return null;
    // Validate on the way out: a stored dossier that no longer fits the schema
    // (e.g. after a schema change) is treated as absent, not rendered broken.
    const parsed = Dossier.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  }
}
