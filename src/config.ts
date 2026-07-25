import "dotenv/config";

// Centralised environment reading and the credential-conflict guard from
// architecture.md 7b. Imported by both the server and the smoke test so the
// checks live in exactly one place.

export interface Config {
  port: number;
  /** True when a usable Anthropic credential is present. */
  hasCredential: boolean;
}

/**
 * Hard error: the SDK sends both headers when key and token are set, and the
 * API rejects the request. Fail loudly here rather than mid-session.
 */
export function assertNoCredentialConflict(): void {
  const hasKey = process.env.ANTHROPIC_API_KEY != null;
  const hasToken = process.env.ANTHROPIC_AUTH_TOKEN != null;
  if (hasKey && hasToken) {
    throw new Error(
      "Both ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN are set. The SDK sends " +
        "both headers and the API rejects the request. Unset one — this project " +
        "uses ANTHROPIC_AUTH_TOKEN (see docs/architecture.md 7b).",
    );
  }
}

/**
 * True when a non-empty credential is available. An empty ANTHROPIC_API_KEY
 * still occupies its precedence slot, so treat empty as "present but broken"
 * — the conflict guard and this check together surface that.
 */
export function hasCredential(): boolean {
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean((token && token.trim()) || (key && key.trim()));
}

export function loadConfig(): Config {
  assertNoCredentialConflict();
  return {
    port: Number(process.env.PORT ?? 3000),
    hasCredential: hasCredential(),
  };
}
