import { Store, displayLemma, type CaptureRow, type WordRow } from "./store.ts";

// Word capture (architecture.md §5b). The app only *saves* taps as pending; it
// never builds a dossier. Lemma resolution here is best-effort — enough for the
// tray display and to link a word_id — while the scheduled collection task does
// the real resolution and dedup later.

export interface Resolved {
  surface: string;
  lemma: string | null;
  word: WordRow | undefined;
  display: string;
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Match a tapped surface form against the word list, trying German case variants. */
export function resolveSurface(store: Store, surface: string): Resolved {
  for (const candidate of [surface, cap(surface), surface.toLowerCase()]) {
    const word = store.findWordByLemma(candidate);
    if (word) return { surface, lemma: word.lemma, word, display: displayLemma(word) };
  }
  return { surface, lemma: null, word: undefined, display: surface };
}

/** Toggle a capture: create it if new, remove it if already active (undo on re-tap). */
export function toggleCapture(store: Store, surface: string, sessionId: number): { marked: boolean } {
  const resolved = resolveSurface(store, surface);
  const existing = store.activeCapture(surface, resolved.lemma);
  if (existing) {
    store.deleteCapture(existing.id);
    return { marked: false };
  }
  store.insertCapture({
    surfaceForm: surface,
    lemma: resolved.lemma,
    wordId: resolved.word?.id ?? null,
    sessionId,
  });
  return { marked: true };
}

/** How a capture reads in the tray: the resolved lemma (with article) or the raw tap. */
export function captureDisplay(store: Store, c: CaptureRow): string {
  if (c.word_id != null) {
    const w = store.getWord(c.word_id);
    if (w) return displayLemma(w);
  }
  return c.lemma ?? c.surface_form;
}
