import { Store } from "./store.ts";
import { seedDossiersFromFile } from "./seed.ts";
import { resolveSurface } from "./capture.ts";
import { SCHEMA_VERSION } from "./dossier/schema.ts";

// The offline collection task (architecture.md §5b), run as Claude Code — not by
// the app. It loads the hand-authored dossiers into the store and works through
// pending captures with the dedup gate. It never calls a model; new content is
// authored by hand into the seed files, then loaded here.

export interface CollectReport {
  dossiersLoaded: number;
  dossiersSkipped: string[];
  captures: {
    queued: string[]; // resolved to a seed word that has a dossier — ready to offer
    dismissed: string[]; // self-tap or duplicate
    needsDossier: string[]; // no seed word / no dossier yet — author one, then re-run
  };
  wordsMissingDossier: string[]; // seed words with no dossier at the current version
}

export function runCollect(store: Store): CollectReport {
  const seed = seedDossiersFromFile(store);
  const captures = processPendingCaptures(store);
  const wordsMissingDossier = store
    .wordsMissingDossier(SCHEMA_VERSION)
    .map((w) => `${w.lemma} (${w.level})`);
  return {
    dossiersLoaded: seed.loaded,
    dossiersSkipped: seed.skipped,
    captures,
    wordsMissingDossier,
  };
}

function processPendingCaptures(store: Store): CollectReport["captures"] {
  const queued: string[] = [];
  const dismissed: string[] = [];
  const needsDossier: string[] = [];
  const seenLemmas = new Set<string>();

  for (const c of store.pendingCaptures()) {
    const r = resolveSurface(store, c.surface_form);

    // Self-tap: tapping the studied word inside its own dossier is a misfire.
    if (c.session_id != null && r.lemma && store.sessionWordLemma(c.session_id) === r.lemma) {
      store.setCaptureStatus(c.id, "dismissed");
      dismissed.push(`${c.surface_form} (self-tap)`);
      continue;
    }

    // Duplicate: a second active capture for the same lemma.
    const key = r.lemma ?? c.surface_form.toLowerCase();
    if (seenLemmas.has(key)) {
      store.setCaptureStatus(c.id, "dismissed");
      dismissed.push(`${c.surface_form} (duplicate)`);
      continue;
    }
    seenLemmas.add(key);

    // Not a seed word (or unresolved): needs a word entry + an authored dossier.
    if (!r.word) {
      store.resolveCapture(c.id, r.lemma, null, "resolved");
      needsDossier.push(c.surface_form);
      continue;
    }

    // Marked known → retraction: a re-captured word must leave known_words (§5b).
    if (store.isKnown(r.word.id)) store.unmarkKnown(r.word.id);

    // Dossier already built → ready to offer; otherwise author one for this seed word.
    if (store.getDossierJson(r.word.id, SCHEMA_VERSION) != null) {
      store.resolveCapture(c.id, r.word.lemma, r.word.id, "queued");
      queued.push(r.display);
    } else {
      store.resolveCapture(c.id, r.word.lemma, r.word.id, "resolved");
      needsDossier.push(r.display);
    }
  }

  return { queued, dismissed, needsDossier };
}
