import type { Dossier } from "./schema.ts";

// How the app obtains a dossier. It only ever reads — dossiers are built offline
// by the collection task (architecture.md §5b, §7b). No implementation touches the
// network. `null` means "not built yet", in which case the word simply isn't offered.

export interface WordInput {
  /** When known (the app always has it), lets a store-backed source skip a lookup. */
  id?: number;
  lemma: string;
  pos: string;
}

export interface DossierSource {
  readonly kind: "fixture" | "stored";
  get(word: WordInput): Promise<Dossier | null>;
}
