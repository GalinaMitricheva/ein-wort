import { bootstrapStore } from "../src/core/bootstrap.ts";
import { runCollect } from "../src/core/collect.ts";

// The collection task's command surface (architecture.md §5b). Run as Claude
// Code — `npm run collect` — to sync hand-authored dossiers into the store and
// work through pending captures. Idempotent; safe to re-run.

const { store } = bootstrapStore();
const r = runCollect(store);

const list = (label: string, items: string[]): void => {
  if (!items.length) return;
  console.log(`\n${label} (${items.length}):`);
  for (const x of items) console.log(`  • ${x}`);
};

console.log("── collection run ─────────────────────");
console.log(`dossiers loaded: ${r.dossiersLoaded}`);
list("dossiers skipped", r.dossiersSkipped);
list("captures → queued", r.captures.queued);
list("captures → dismissed", r.captures.dismissed);
list("captures → need a dossier (author, then re-run)", r.captures.needsDossier);
list("seed words missing a dossier", r.wordsMissingDossier);

const outstanding = r.captures.needsDossier.length + r.wordsMissingDossier.length;
console.log("───────────────────────────────────────");
console.log(
  outstanding === 0
    ? "All words have dossiers; all captures resolved."
    : `${outstanding} item(s) still need an authored dossier.`,
);
process.exit(0);
