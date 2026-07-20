# Ein Wort — Development Plan & Tracker

**Status:** Active · **Last updated:** 2026-07-20 · Companion to [architecture.md](architecture.md)

This is the working tracker. Check tasks off as they land. Phases follow the build
order in architecture.md §9 — the loop gets onto the phone before the word pipeline
is built, so daily use starts early.

---

## How to read the model column

Each task is routed to the cheapest model that won't jeopardize quality. Escalate on
ambiguity, subtle correctness, or wide blast radius; downgrade when the work is fully
specified, mechanical, and cheap to redo.

| Tag | Model ID | Use for |
|---|---|---|
| **H** | `claude-haiku-4-5` | Mechanical, low-ambiguity work determined by the brief: scaffolding, boilerplate, rote refactors, config, format conversion |
| **S** | `claude-sonnet-5` | Standard implementation to spec, well-localized bugs, meaningful tests. **The default when unsure.** |
| **O** | `claude-opus-4-8` | Hard reasoning, subtle correctness, prompt authoring, anything expensive to get wrong |
| **M** | — | Manual / human judgment. Not delegable to any model. |

Delegating costs a cold start — each sub-agent re-derives context and needs a
self-contained brief. Tasks below are sized so that tax pays off. Anything marked
"inline" is faster to just do than to brief.

**Never delegate:** changes to architecture.md itself, the licensing verification
(5.1), and level-assignment review (5.8). These need judgment across the whole
project, and a wrong answer is costly to catch later.

---

## Phase 0 — Project scaffold

Fully mechanical. All parallelizable.

- [ ] **0.1** `package.json`, `tsconfig.json`, `.gitignore`, `.env.example` — **H**
      ⚠️ `.env.example` must **not** contain `ANTHROPIC_API_KEY`. An empty value still
      occupies its precedence slot and authenticates with an empty key, silently
      overriding the OAuth profile. See architecture.md §7b.
- [ ] **0.5** One-time `ant auth login`, then verify with `ant auth status`. Resolve any
      Claude Code auth conflict by keeping one credential source — **M**
- [ ] **0.2** `.gitattributes` with `* text=auto` to settle the CRLF warning — **H** · inline
- [ ] **0.3** Fastify server booting on :3000 with a health route — **H**
- [ ] **0.4** htmx + base HTML layout template, no styling yet — **H**

---

## Phase 1 — Data layer

1.1 must land before the rest; 1.2–1.4 can then run in parallel.

- [ ] **1.1** Migration runner (numbered `.sql` files, `schema_migrations` table) — **S**
- [ ] **1.2** Initial migration: `words`, `known_words`, `sessions`, `dossiers` — transcribe verbatim from architecture.md §3 — **H**
- [ ] **1.3** `core/store.ts` — typed accessors for each table — **S**
- [ ] **1.4** 20-word hand-checked fixture across B1/B2/C1 — **S**
      ⚠️ Articles, plurals, and verb forms must be right. Wrong gender data reads as an
      engine bug and poisons trust in calibration. Spot-check every row against Duden
      before committing — this is cheap at 20 words and expensive to discover later.

---

## Phase 2 — Core loop, stubbed dossier

Goal: the full §4 loop working end to end with fake dossier content. Proves the
interaction before any LLM spend.

- [ ] **2.1** `core/selection.ts` — next unoffered, unknown word at active level by frequency rank — **S**
- [ ] **2.2** Session routes: start → calibrate → dossier → anchor → done — **S**
- [ ] **2.3** Offer + calibrate view (3 buttons; *Know it* marks known and re-offers immediately) — **S**
- [ ] **2.4** Dossier display view — the typographically dense one; §6 chose a web app for this — **S**
- [ ] **2.5** Anchor input; sets `sessions.anchor_completed` only. The sentence itself is
      never written to the database (architecture.md §7) — **S**
- [ ] **2.6** Stub dossier fixture matching the §5 schema shape — **H**
- [ ] **2.7** Level selector (self-declared, changeable anytime) — **H**
- [ ] **2.8** Session complete screen — no "next word" button (§3.1, §7) — **H**
- [ ] **2.9** Level-exhausted state — guaranteed to fire with the 20-word fixture,
      so build it now rather than hitting a crash — **S**
- [ ] **2.10** *Know it* micro-confirmation — rapid rejection with no visual
      acknowledgement reads as broken — **H**
- [ ] **2.11** Session-resume behaviour: app closed mid-dossier, reopened later.
      Resume in place or discard — decide, then implement — **S**
- [ ] **2.12** Empty-log and no-search-results states — **H**

See [ui.md](ui.md) for the full screen and state inventory, and the design review tracker.

---

## Phase 3 — LLM integration

The quality core. Prompt authoring is **O** — it's where §11's stated risk actually
lives, and a bad register label is exactly the "cheap wrong answer" worth paying to avoid.

- [ ] **3.1** Zod dossier schema per architecture.md §5 — **S**
- [ ] **3.2** **Dossier prompt authoring** — meaning, examples, collocations, register,
      near-synonym distinctions. Needs real judgment about what makes usage guidance
      trustworthy for a B2+ learner — **O**
- [ ] **3.3** `core/dossier.ts` — `messages.parse()` + `zodOutputFormat`, adaptive thinking,
      cache on `(word_id, schema_version)` — **S**
- [ ] **3.3b** Background pre-generation of the *next* word's dossier on session end.
      Turns the loading state into a rare fallback instead of a normal step — **S**
- [ ] **3.3c** Dossier-generation failure state: retry or skip, never lose the session — **S**
- [ ] **3.4** `regenerate` CLI: one word / all words / by level — **H**
- [ ] **3.5** **Anchor feedback prompt** — rewrite-plus-note, no verdict. Must bias hard
      toward returning the sentence unchanged: over-correction teaches false German at
      the moment of maximum receptiveness (architecture.md §7) — **O**
- [ ] **3.6** `core/anchor.ts` — `claude-opus-4-8`, adaptive thinking, `effort: "medium"`,
      cached dossier passed as context so feedback can't contradict the dossier.
      *Revised from `effort: "low"`: that was sizing the task, not the stakes* — **S**
- [ ] **3.6b** Dispute affordance (*"Das war Absicht"*) writing to a separate
      `feedback_disputes` table. The anchor step is otherwise fully ephemeral — sentence,
      rewrite and note all discarded after render. The dispute path is the single opt-in
      exception, and lives outside `sessions` so no log query can reach it — **H**
- [ ] **3.7** "Report an error" affordance writing to `dossiers.error_report` (§11 says MVP, not later) — **H**

### Word capture (architecture.md §5b)

- [ ] **3.8** `captures` table migration — **H**
- [ ] **3.9** Tap-to-capture in collocations and examples; marked state, undo on
      re-tap, "Gemerkt für später" tray — **S**
- [ ] **3.10** Lemma resolution against `words.lemma` at capture time, for tray display — **S**
- [ ] **3.10b** Dedup gate before scheduling generation: self-tap, duplicate capture,
      dossier already exists, already met, marked known. Plus the partial unique index
      on active-capture lemma — **S**
      Includes the `known_words` retraction: tapping a word previously answered
      *Kenne ich* removes it from `known_words`, or it stays permanently unreachable.
- [ ] **3.11** Nightly job: resolve → dedup gate → level/source assign → batch dossier
      generation via `messages.batches.create()` → mark `queued`. Per-item failure
      isolation keyed on `custom_id` — **S**
- [ ] **3.12** Staleness-triggered scheduling — run on app start if last successful run
      is >24h old. Not a wall-clock cron: the laptop sleeps and a fixed-time job would
      silently never fire — **S**
- [ ] **3.13** Per-run word cap (~50) and capture dismissal path — **H**
- [ ] **3.14** Selection engine: captured words with `status = 'queued'` outrank
      frequency order — **S**

---

## Phase 4 — Get it on the phone

After this phase you're using it daily and the §9 metric starts counting.

- [ ] **4.1** Tailscale install + `tailscale serve`, phone joins tailnet — **M** (account and device auth)
- [ ] **4.2** Web app manifest + icons so it installs to the home screen — **H**
      Not cosmetic: §6 rules out notifications and §7 rules out streaks, so the home-screen
      icon is the only thing prompting unprompted use.
- [ ] **4.3** Mobile CSS pass — one-handed, U-Bahn-legible, no horizontal scroll — **S**

---

## Phase 5 — Composite word list (§5 of the brief)

The largest chunk. 5.1 gates everything else. 5.2/5.3 parallelize; 5.4 is the real work.

- [ ] **5.1** **Acquire sources + verify license terms** for each non-Goethe list
      (publisher B2/C1, Telc, frequency corpus). Confirm against actual license text,
      not assumption — some are non-commercial. Blocks publishing any word data — **M**
- [ ] **5.2** `01-extract-goethe.ts` — B1 PDF → structured rows — **S**
- [ ] **5.3** `02-extract-publisher.ts` — B2/C1 + Telc sources — **S**
- [ ] **5.4** **`03-normalize.ts`** — the hard part, per architecture.md §6: verb
      principal parts, separable prefixes (`anrufen`/`ruft an`), reflexives
      (`sich erinnern`), noun headword variance, ß/ss. A wrong normalizer produces a
      list that looks correct and silently offers the same word twice — **O**
- [ ] **5.5** `04-dedupe.ts` against the A1–B1 base — **S**
- [ ] **5.6** `05-rank.ts` — join frequency data → `frequency_rank` — **H**
- [ ] **5.7** `06-emit.ts` → `words.seed.json`, with a build-time assertion that no two
      rows share a normalized key — **S**
- [ ] **5.8** **Review level assignments** at the B2/C1 boundary. §5 calls these editorial
      judgments versioned like code — a model can propose, only you can ratify — **M**
- [ ] **5.9** Seed importer: `words.seed.json` → `words` table, idempotent — **S**

---

## Phase 6 — Words met log

- [ ] **6.1** Words-met view: three most recent words with meanings, no dates, no
      grouping, no level indicators. Lists **distinct words by most recent session**,
      since retraction means a word can have more than one — **S**
- [ ] **6.1b** Log detail: shared dossier partial with session chrome suppressed, plus
      `Kenne ich doch nicht` (delete `known_words` row + insert capture → dedup gate
      sends it straight to `queued`, dossier already built). Inline
      *Kommt wieder dran* confirmation, no dialog — **S**
- [ ] **6.1c** Captured-words line counts `pending` only, not `queued` — it's the
      nightly-job health signal, and counting `queued` produces false alarms during
      normal busy weeks (ui.md screen 6) — **H**
- [ ] **6.2** Search (SQLite FTS5 over lemma + meaning), **scoped to words with a
      completed session**. Captured and queued words are excluded — they aren't history,
      and have no dossier to open until the nightly job runs — **S**
- [ ] **6.3** Metrics query for §9: sessions/week, *Know it* rejection rate, anchor
      completion rate, median session length — **H**

---

## Phase 7 — Quality gate

- [ ] **7.1** **Spot-check the first 20 generated dossiers against DWDS/Duden.** Structured
      outputs guarantee shape, not truth. Do this before trusting the pipeline — **M**
- [ ] **7.2** Unit tests: selection engine, normalizer, dedupe — **S**
- [ ] **7.3** Backup: cron `cp` of the SQLite file — **H**

---

## Parallelization map

Where independent workstreams can run concurrently, each with its own brief:

| After | Can run in parallel |
|---|---|
| 0.1 | 0.2, 0.3, 0.4 |
| 1.1 | 1.2, 1.3, 1.4 |
| 2.2 | 2.3, 2.4, 2.5, 2.7 |
| 3.1 | 3.3, 3.4, 3.7 |
| 5.1 | 5.2, 5.3 |
| — | Phase 4 runs alongside Phase 5 entirely |

Do **not** parallelize within a single file — 2.3/2.4/2.5 touch separate templates and
routes, but if they start sharing a layout file, serialize them instead.

---

## Deliberately not in scope

From brief §7, permanent: spaced repetition, review scheduling, streaks, points,
gamification, a learning-strategies layer. From §6, deferred: accounts/multi-user,
A1–A2 content, audio, offline mode, native app, notifications.

Open question §10.4 (real-content snippets) stays open on copyright grounds — see
architecture.md §5.

v2 candidates, not tracked here: bring-your-own-word, themed packs, log export,
additional languages.
