import { hasCredential } from "../../config.ts";
import type { LlmProvider } from "./provider.ts";
import { FixtureProvider } from "./fixture.ts";
import { AnthropicProvider } from "./anthropic.ts";

export type { LlmProvider, WordInput, AnchorInput } from "./provider.ts";
export { Dossier, AnchorFeedback, Register } from "./schema.ts";

// Factory: fixtures by default; the real provider only when explicitly requested
// AND a credential is present. A missing credential degrades to fixtures with a
// warning rather than crashing (architecture.md §7b).

export interface SelectOptions {
  /** Overrides EIN_WORT_LLM. Mainly for tests. */
  mode?: "fixture" | "anthropic";
  warn?: (message: string) => void;
}

export function selectProvider(options: SelectOptions = {}): LlmProvider {
  const requested = options.mode ?? process.env.EIN_WORT_LLM ?? "fixture";
  const warn = options.warn ?? ((m: string) => console.warn(m));

  if (requested === "anthropic") {
    if (!hasCredential()) {
      warn(
        "EIN_WORT_LLM=anthropic but no credential is set — falling back to fixtures. " +
          "Set ANTHROPIC_API_KEY to use real generation (docs/architecture.md §7b).",
      );
      return new FixtureProvider();
    }
    return new AnthropicProvider();
  }
  return new FixtureProvider();
}
