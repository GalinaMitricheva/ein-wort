import "dotenv/config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The running app makes no model API calls and needs no Anthropic credential
// (architecture.md §7b) — so config is just the port and the database file.

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB = join(here, "..", "data", "ein-wort.db");

export interface Config {
  port: number;
  dbFile: string;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
    dbFile: process.env.EIN_WORT_DB ?? DEFAULT_DB,
  };
}
