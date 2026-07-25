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

- [x] **0.1** `package.json`, `tsconfig.json`, `.gitignore`, `.env.example` — **H**
      ⚠️ `.env.example` must **not** contain `ANTHROPIC_API_KEY`. An empty value still
      occupies its precedence slot and authenticates with an empty key, silently
      overriding the OAuth profile. See architecture.md §7b.
- [x] **0.5** ~~`claude setup-token`~~ **Decided: subscription path rejected, dev runs on
      fixtures.** setup-token writes a Pro-subscription OAuth credential into Claude
      Code's private store — no portable token, ~8h expiry, unusable for the unattended
      nightly job, and reading it is (rightly) classifier-blocked. Real credentials
      deferred to Phase 3 (architecture.md §7b) — **M**
- [x] **0.6** **Credential smoke test — superseded by the provider abstraction.** The
      `messages.batches.create` question moves to Phase 3, when the Anthropic provider is
      built against real billing. The credential-free equivalent — fixture provider
      returns schema-valid dossiers and both anchor states — is verified. `scripts/smoke-test.ts`
      is kept for that Phase 3 check — **S**

### Provider abstraction (architecture.md §7b) — done this session

- [x] **P.1** `core/llm` seam: `LlmProvider` interface, `FixtureProvider`, `selectProvider`
      factory (fixtures by default; degrades to fixtures if `anthropic` requested without a
      credential). `AnthropicProvider` is a marked Phase-3 seam — **S**
- [x] **P.2** Dossier + AnchorFeedback Zod schemas, reconciled with the approved screens
      (Formen + Rektion). *Pulls task 3.1 forward.* — **S**
- [x] **P.3** `erörtern` fixture (the worked example from the mockups) + thin placeholder
      for any other word. *Covers task 2.6.* — **H**
- [x] **0.2** `.gitattributes` with `* text=auto` to settle the CRLF warning — **H** · inline
- [x] **0.3** Fastify server booting on :3000 with a health route — **H**
- [x] **0.4** htmx + base HTML layout template, no styling yet — **H**

---

## Phase 1 — Data layer

1.1 must land before the rest; 1.2–1.4 can then run in parallel.

- [x] **1.1** Migration runner (`core/db.ts`) — numbered `.sql` files, `schema_migrations`
      table, each applied in its own transaction. `better-sqlite3` (prebuilt binary, no
      compile) — **S**
- [x] **1.2** Initial migration (`migrations/001_init.sql`): `words`, `known_words`,
      `sessions`, `dossiers`, `captures` + the `captures_active_lemma` partial unique index.
      Reflects the current §3 schema (no anchor columns, no `feedback_disputes`) — **H**
- [x] **1.3** `core/store.ts` — typed accessors for every table, plus `bootstrap.ts`
      (open → migrate → seed-if-empty) wired into server boot — **S**
- [x] **1.4** 20-word fixture across B1/B2/C1 (`data/words.fixture.json`) — bare-lemma
      nouns with `article`/`plural`, verbs with `key_forms`. **Still wants a Duden
      spot-check** (own-German, not yet verified) before it's trusted — **S**

---

## Phase 2 — Core loop, stubbed dossier

Goal: the full §4 loop working end to end with fake dossier content. Proves the
interaction before any LLM spend.

- [ ] **2.1** `core/selection.ts` — next unoffered, unknown word at active level by frequency rank — **S**
- [ ] **2.2** Session routes: start → calibrate → dossier → done (no anchor; §7) — **S**
- [ ] **2.3** Offer + calibrate view (3 buttons; *Know it* marks known and re-offers immediately) — **S**
- [ ] **2.4** Dossier display view — the typographically dense one; §6 chose a web app for this.
      `Weiter` goes straight to session complete — **S**
- [ ] ~~**2.5** Anchor input~~ — cut from MVP (anchor step deferred, architecture.md §7)
- [x] **2.6** Stub dossier fixture matching the §5 schema shape — **H** · done as P.3
- [ ] **2.7** Level selector (self-declared, changeable anytime) — **H**
- [ ] **2.8** Session complete screen — no "next word" button (§3.1, §7) — **H**
- [ ] **2.9** Level-exhausted state — guaranteed to fire with the 20-word fixture,
      so build it now rather than hitting a crash — **S**
- [ ] **2.10** *Know it* micro-confirmation — rapid rejection with no visual
      acknowledgement reads as broken — **H**
- [ ] **2.11** Session-resume behaviour: app closed mid-dossier, reopened later.
      Resume in place or discard — decide, then implement — **S**
- [ ] **2.12** Empty-log and no-search-results states — **H**
- [ ] **2.13** Level selector reached from the settings gear on the log header; level
      changes never touch the queue (ui.md screen 9) — **H**
- [ ] **2.14** First run: single level question, B2 preselected, one button — **H**

See [ui.md](ui.md) for the full screen and state inventory, and the design review tracker.

---

## Phase 3 — Dossier collection (Claude Code task, not in-app)

The app never generates dossiers (architecture.md §5b) — it reads them. This phase is the
offline collection task that *builds* them, run as Claude Code on a schedule you set. It
needs no in-app credential; the app makes zero model calls.

- [x] **3.1** Zod dossier schema per architecture.md §5 — **S** · done as P.2
- [ ] **3.2** **Dossier prompt authoring** — meaning, examples, collocations, register,
      near-synonym distinctions. Needs real judgment about what makes usage guidance
      trustworthy for a B2+ learner — **O**
- [ ] **3.3** The collection task: read `pending` captures + seed words lacking a dossier,
      build each with `messages.parse()` + `zodOutputFormat` + adaptive thinking, write to
      the `dossiers` store, mark `queued`. Idempotent — re-runnable, unfinished items stay
      `pending`. This is the same mechanism that seeds the word list (§6) — **O**
- [ ] **3.4** `DossierSource` real implementation: read stored dossiers from SQLite
      (fixture source already exists as P.1). `null` when not yet built → word not offered — **S**
- [ ] **3.7** "Report an error" affordance writing to `dossiers.error_report` (§11 says MVP, not later) — **H**

### Word capture (architecture.md §5b)

- [ ] **3.8** `captures` table migration — **H**
- [ ] **3.9** Tap-to-capture in collocations and examples; marked state, undo on
      re-tap, "Gemerkt für später" tray. **App only saves the tap (`pending`)** — no
      generation, no automation — **S**
- [ ] **3.10** Lemma resolution against `words.lemma` at capture time, for tray display — **S**
- [ ] **3.10b** Dedup gate, applied by the collection task: self-tap, duplicate capture,
      dossier already exists, already met, marked known. Plus the partial unique index
      on active-capture lemma — **S**
      Includes the `known_words` retraction: tapping a word previously answered
      *Kenne ich* removes it from `known_words`, or it stays permanently unreachable.
- [ ] **3.13** Capture dismissal path — drop a `pending` capture without offering it — **H**
- [ ] **3.14** Selection engine: captured words with `status = 'queued'` outrank
      frequency order — **S**

*Removed with the nightly-job design (architecture.md §5b): in-app batch generation
(3.11), staleness-triggered scheduling (3.12), per-run caps, and the whole anchor step
(3.5, 3.6, 3.6b — deferred to post-MVP, §7).*

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
      collection health signal, and counting `queued` produces false alarms during
      normal busy weeks (ui.md screen 6) — **H**
- [ ] **6.2** Search (SQLite FTS5 over lemma + meaning), **scoped to words with a
      completed session**. Captured and queued words are excluded — they aren't history,
      and have no dossier to open until collection runs — **S**
- [ ] **6.3** Metrics query for §9: sessions/week, *Know it* rejection rate, median
      session length. (Anchor-completion metric dropped with the step, §7) — **H**

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
| 2.2 | 2.3, 2.4, 2.7 |
| 3.2 | 3.4, 3.7 |
| 5.1 | 5.2, 5.3 |
| — | Phase 4 runs alongside Phase 5 entirely |

Do **not** parallelize within a single file — 2.3/2.4 touch separate templates and
routes, but if they start sharing a layout file, serialize them instead.

---

## Deliberately not in scope

**The running app makes no model API calls and needs no credential** (architecture.md §7b).
Dossiers are pre-built by the scheduled collection task; the anchor step is deferred.

From brief §7, permanent: spaced repetition, review scheduling, streaks, points,
gamification, a learning-strategies layer. From §6, deferred: accounts/multi-user,
A1–A2 content, audio, offline mode, native app, notifications.

**Deferred to post-MVP:** the anchor step (write a sentence, get feedback). Designed and
approved, then cut when no fast, reliable local feedback proved possible on this hardware
(architecture.md §7). Returns with faster hardware or an API credential.

Open question §10.4 (real-content snippets) stays open on copyright grounds — see
architecture.md §5.

v2 candidates, not tracked here: bring-your-own-word, themed packs, log export,
additional languages.
