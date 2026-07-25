import type { LlmProvider, WordInput, AnchorInput } from "./provider.ts";
import type { Dossier, AnchorFeedback } from "./schema.ts";

// The real-generation seam. The interface is real now; the API-calling body is
// written and tested in Phase 3, once API billing exists to test it against
// (architecture.md §7b). Until then, selecting this provider is an explicit error
// rather than dead, untested code pretending to work.
//
// When built, this uses `client.messages.parse()` with `zodOutputFormat(Dossier)`,
// adaptive thinking, and the dossier passed as context to assessAnchor — the shapes
// are specified in architecture.md §5 and §7.

const NOT_YET =
  "The Anthropic provider is not built yet (Phase 3). Set EIN_WORT_LLM=fixture, " +
  "or leave it unset, to run on fixtures. See docs/architecture.md §7b.";

export class AnthropicProvider implements LlmProvider {
  readonly mode = "anthropic" as const;

  async generateDossier(_word: WordInput): Promise<Dossier> {
    throw new Error(NOT_YET);
  }

  async assessAnchor(_input: AnchorInput): Promise<AnchorFeedback> {
    throw new Error(NOT_YET);
  }
}
