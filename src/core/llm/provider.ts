import type { Dossier, AnchorFeedback } from "./schema.ts";

// The single seam between the app and Claude (architecture.md §7b). Everything
// that needs model output depends on this interface, never on the SDK directly —
// so the whole app runs on fixtures in development and swaps to real generation
// with one config flag once credentials exist.

/** Minimal description of a word, enough to generate or look up its dossier. */
export interface WordInput {
  lemma: string;
  pos: string;
}

/** A learner's anchor sentence plus the dossier it was written against. */
export interface AnchorInput {
  word: WordInput;
  /** The dossier is passed as context so feedback can't contradict it (architecture.md §7). */
  dossier: Dossier;
  sentence: string;
}

export interface LlmProvider {
  readonly mode: "fixture" | "anthropic";
  generateDossier(word: WordInput): Promise<Dossier>;
  assessAnchor(input: AnchorInput): Promise<AnchorFeedback>;
}
