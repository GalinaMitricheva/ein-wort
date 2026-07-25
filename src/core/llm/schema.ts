import { z } from "zod";

// The dossier schema (architecture.md §5), reconciled with the approved screens
// (ui.md screens 2 and 7): Formen and Rektion blocks included. Enforced, not
// requested — under the real provider this is passed through structured outputs,
// so the model cannot return a dossier missing a register label or a malformed
// block. The fixture provider validates its canned data against the same schema,
// so a bad fixture fails exactly where a bad generation would.

export const Register = z.enum(["formal", "neutral", "colloquial", "regional"]);

export const Dossier = z.object({
  meaning_de: z.string(),
  meaning_en: z.string(),
  // Verb conjugation or noun declension. Label/value keeps verbs and nouns uniform;
  // the screen renders one row per entry. All four verb forms always present (ui.md 7).
  forms: z.array(z.object({ label: z.string(), value: z.string() })),
  // Valency patterns with case government. Empty for words that take no object.
  rektion: z.array(z.object({ pattern: z.string(), cases: z.string() })),
  collocations: z.array(z.object({ phrase: z.string(), gloss_en: z.string() })),
  examples: z.array(z.object({ de: z.string(), en: z.string() })).min(2).max(3),
  register: Register,
  register_note: z.string(),
  near_synonyms: z.array(z.object({ lemma: z.string(), distinction: z.string() })),
});

// Rewrite plus one-line note, never a verdict (architecture.md §7). A rewrite equal
// to the input renders as "Klingt natürlich"; the whole thing is discarded after render.
export const AnchorFeedback = z.object({
  rewrite: z.string(),
  note: z.string(),
});

export type Dossier = z.infer<typeof Dossier>;
export type AnchorFeedback = z.infer<typeof AnchorFeedback>;
export type Register = z.infer<typeof Register>;
