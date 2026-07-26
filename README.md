# Ein Wort

> One word per session. Learned in its natural habitat, not on a flashcard.

A small, personal web app for topping up **advanced German vocabulary**. Each session
offers a single word, checks whether you already know it, and — if you don't — shows a
compact "dossier": what it means, how it's used, the company it keeps, and how it differs
from its near-synonyms. Then it gets out of the way.

## What it is (and isn't)

- **Personal, not exam prep.** It makes no claim to cover any CEFR level or prepare you
  for a certificate. It uses **no published or copyrighted word lists** — the vocabulary
  is a hand-curated pool that grows over time.
- **The point is calibration, not coverage.** It doesn't matter which words are in the
  pool. What matters is that you skip the ones you already know and can capture the ones
  you don't. Every "I know this" sharpens what you're offered next.
- **No learning machinery.** No spaced repetition, no streaks, no points, no review queue.
  For someone immersed in the language, life is the repetition machine.

## How a session works

1. **Offer + calibrate** — one word with its forms, and three buttons: *Kenne ich* /
   *Vage* / *Neu für mich*. "Know it" marks it learned and offers the next word immediately.
2. **Dossier** — meaning (DE + EN), verb forms or noun declension, case government
   (Rektion), collocations, example sentences, a register note, and near-synonym
   distinctions. Tap any word in the collocations or examples to **capture** it for later.
3. **Done** — the word lands in your "Words met" log. Session over.

When you've met every word in the pool at your level, you see a calm end screen — the pool
grows when new words are added.

## No API key, no cloud

The running app makes **zero model API calls** and needs **no credential**. Dossiers are
pre-built offline by a collection task (run as Claude Code, `npm run collect`) and stored
in SQLite; the app only ever reads them. Everything runs locally.

## Tech

Node 22 · TypeScript · Fastify · SQLite (`better-sqlite3`) · htmx · server-rendered HTML,
no build step. Data (words + dossiers) lives in `data/*.json`, loaded into SQLite on boot.

## Run it

```bash
cd ein-wort
npm install
npm start          # → http://localhost:3000
```

For a clean first run (fresh database): `rm -f data/ein-wort.db*` first.

## Growing the pool

The word list and dossiers are plain JSON, authored by hand (with Claude):

1. Add words to a `data/words.*.json` file (bare lemma, gender/plural for nouns, forms for
   verbs, a level tag).
2. Author dossiers in a `data/dossiers.*.json` file (glob-loaded — new batch files are
   picked up automatically).
3. Run `npm run collect` to load them and confirm no word is missing a dossier.

## Status

- **C1:** all 101 words have dossiers.
- **B1 / B2:** 14 starter words so far.
- Content is the author's own German and wants a Duden/DWDS spot-check before it's fully
  trusted.

## Docs

- [`docs/architecture.md`](docs/architecture.md) — how it's built and why.
- [`docs/plan.md`](docs/plan.md) — the working tracker (start here to pick up work).
- [`docs/ui.md`](docs/ui.md) — the screens and design language.
