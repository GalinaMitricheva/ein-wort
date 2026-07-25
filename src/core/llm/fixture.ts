import type { LlmProvider, WordInput, AnchorInput } from "./provider.ts";
import { Dossier, AnchorFeedback } from "./schema.ts";
import { fixtureDossier } from "./fixtures.ts";

// Credential-free provider for development, tests, and demos. Deterministic: a
// word always yields the same dossier. Validates its own output against the
// schema, so a malformed fixture fails exactly where a malformed generation would.

export class FixtureProvider implements LlmProvider {
  readonly mode = "fixture" as const;

  async generateDossier(word: WordInput): Promise<Dossier> {
    return Dossier.parse(fixtureDossier(word));
  }

  async assessAnchor(input: AnchorInput): Promise<AnchorFeedback> {
    // Fixtures can't judge naturalness. A canned heuristic stands in only so both
    // UI states (rewrite / unchanged) are reachable while building screen 4: it
    // demonstrates the one preposition-government error the anchor step exists to
    // catch, and otherwise returns the sentence unchanged. Not a real assessment.
    // Note: no leading \b — in JS regex \b is ASCII-only, so \büber never matches
    // "über" after a space (both sides are non-word chars to the engine).
    const match = /über\s+(dem|den|das|die)\b/i.exec(input.sentence);
    if (match) {
      return AnchorFeedback.parse({
        rewrite: input.sentence.replace(match[0], match[0].replace(/über\s+/i, "")),
        note: "[Fixtur] Viele Verben verlangen den Akkusativ ohne Präposition. Echte Bewertung folgt in Phase 3.",
      });
    }
    return AnchorFeedback.parse({ rewrite: input.sentence, note: "Klingt natürlich." });
  }
}
