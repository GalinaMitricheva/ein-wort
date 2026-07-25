import type { Dossier } from "./schema.ts";
import type { WordInput } from "./provider.ts";

// Canned dossiers for fixture mode. The erörtern entry is the full worked example
// from the design mockups (ui.md screens 2/7) — it doubles as the reference for
// what a complete, well-shaped dossier looks like. Anything else gets a valid but
// deliberately thin placeholder, so the loop works for any word while making clear
// (by its emptiness) that no real generation happened.

export const EROERTERN: Dossier = {
  meaning_de: "etwas ausführlich und sachlich besprechen, meist in einem formellen Rahmen",
  meaning_en: "to discuss in detail; to deliberate",
  forms: [
    { label: "Präsens", value: "er erörtert" },
    { label: "Präteritum", value: "er erörterte" },
    { label: "Perfekt", value: "er hat erörtert" },
    { label: "Konjunktiv II", value: "er erörterte" },
  ],
  rektion: [
    { pattern: "etwas erörtern", cases: "Akk." },
    { pattern: "etwas mit jemandem erörtern", cases: "Akk. + Dat." },
  ],
  collocations: [
    { phrase: "eine Frage erörtern", gloss_en: "to discuss a question" },
    { phrase: "ein Thema erörtern", gloss_en: "to discuss a topic" },
    { phrase: "ausführlich erörtern", gloss_en: "to discuss in detail" },
    { phrase: "im Detail erörtern", gloss_en: "to discuss in detail" },
  ],
  examples: [
    {
      de: "Der Ausschuss erörterte die Vorschläge in einer mehrstündigen Sitzung.",
      en: "The committee deliberated the proposals over a session lasting several hours.",
    },
    {
      de: "Wir sollten die Frage in Ruhe erörtern.",
      en: "We ought to discuss the question calmly.",
    },
  ],
  register: "formal",
  register_note:
    "Gehoben und sachlich. Zu Hause in Sitzungen, Gutachten und akademischen Texten — unter Freunden klingt es steif.",
  near_synonyms: [
    { lemma: "besprechen", distinction: "neutral, alltäglich — jede Art von Gespräch" },
    { lemma: "diskutieren", distinction: "setzt unterschiedliche Standpunkte voraus" },
  ],
};

const BY_LEMMA: Record<string, Dossier> = {
  erörtern: EROERTERN,
};

/** A schema-valid but visibly thin dossier for any word without a canned entry. */
function placeholder(word: WordInput): Dossier {
  return {
    meaning_de: `[Fixtur] Platzhalter-Bedeutung für „${word.lemma}“.`,
    meaning_en: `[fixture] placeholder meaning for "${word.lemma}".`,
    forms: [],
    rektion: [],
    collocations: [],
    examples: [
      { de: `Beispielsatz mit „${word.lemma}“.`, en: `Example sentence with "${word.lemma}".` },
      { de: `Noch ein Satz mit „${word.lemma}“.`, en: `Another sentence with "${word.lemma}".` },
    ],
    register: "neutral",
    register_note: "[Fixtur] Kein echtes Register — nur Testdaten.",
    near_synonyms: [],
  };
}

export function fixtureDossier(word: WordInput): Dossier {
  return BY_LEMMA[word.lemma] ?? placeholder(word);
}
