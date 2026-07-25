import type { DossierSource, WordInput } from "./source.ts";
import { Dossier } from "./schema.ts";
import { fixtureDossier } from "./fixtures.ts";

// Credential-free, network-free source for development, tests, and demos.
// Deterministic: a word always yields the same dossier. Validates its output
// against the schema, so a malformed fixture fails exactly where malformed
// stored data would.

export class FixtureDossierSource implements DossierSource {
  readonly kind = "fixture" as const;

  async get(word: WordInput): Promise<Dossier | null> {
    return Dossier.parse(fixtureDossier(word));
  }
}
