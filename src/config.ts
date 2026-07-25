import "dotenv/config";

// The running app makes no model API calls and needs no Anthropic credential
// (architecture.md §7b) — so there is nothing to validate here beyond the port.

export interface Config {
  port: number;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
  };
}
