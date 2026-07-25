import { z } from "zod";

// The dossier schema (architecture.md §5), reconciled with the approved screens
// (ui.md screens 2 and 7): Formen and Rektion blocks included. The app never
// generates dossiers — they are pre-built by the offline collection task (§5b)
// and read from storage. This schema is the contract for both: the collection
// task validates what it writes, the fixture source validates its canned data,
// so a malformed dossier fails the same way wherever it comes from.

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

export type Dossier = z.infer<typeof Dossier>;
export type Register = z.infer<typeof Register>;
