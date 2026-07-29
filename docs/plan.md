# Ein Wort — Development Plan & Tracker

**Status:** Active · **Last updated:** 2026-07-26 · Companion to [architecture.md](architecture.md)

This is the working tracker. Check tasks off as they land.

---

## ▶ NEXT SESSION — START HERE

**The app works end to end and runs on real content.** `cd C:/Users/fanof/Projects/ein-wort
&& npm start` → http://localhost:3000 (add `rm -f data/ein-wort.db*` first for a clean
first run). Everything is committed to `main` (github.com/GalinaMitricheva/ein-wort).

**What's done:** core loop (offer/calibrate → dossier → done), word capture (tap to save),
the collection task (`npm run collect`), **all 101 C1 words with real dossiers**, and a
**1000-word curated pool** (see 2026-07-27 note below).

**Word pool is now 1000 (2026-07-27):** 500 B2 · 493 C1 · 7 B1, no duplicate lemmas.
`data/words.b2.json` (493 new B2), `data/words.c1-2.json` (371 new C1), `data/words.c1-3.json`
(21 C1 top-up) joined the original `words.c1.json` (100) and `words.fixture.json` (20).
`seed.ts` now **globs `words.*.json`** (was a hardcoded two-file list), so new batches load
automatically like dossiers do. **Only word entries exist for the ~885 new words — no
dossiers yet**, so none are offerable until authored (§3.4 requires a current dossier).
Genders/plurals/verb-forms are author's German (parallel Sonnet sub-agents) and want the
§7.1 Wiktionary/Duden spot-check before trusting — do it as a local script, not web lookups.

**Dossier campaign (2026-07-27):** authoring dossiers for the 1000-word pool in waves of
disjoint domain batches (**Opus** sub-agents). **765 of 1000 done, all schema-clean, 0
skips** — `npm run collect` reports **250 words still needing a dossier**. Committed so far:
all 10 B2 domains (`dossiers.b2-01..b2-10.json`) plus C1 `dossiers.c1-01.json` (Wissenschaft)
and `dossiers.c1-08.json` (formal adj/adv).

**Still to author — 6 C1 batches (~250 words):** `c1-03` Wirtschaft/Finanzen/Politik,
`c1-04` Psychologie, `c1-05` Kultur/Kunst/Literatur, `c1-06` Geschichte/Gesellschaft/
Philosophie, `c1-07` formal verbs, and `c1-topup` (the 21 words from `words.c1-3.json` that
rounded the pool to 1000). Each has a word-list input in the session scratchpad
(`out/<id>.json`); if that's gone, re-derive the missing lemmas from `npm run collect`.

**To finish:** spawn one **Opus** author per remaining batch against the dossier brief
(schema in `src/core/dossier/schema.ts`; conventions: noun→Genitiv/Plural, verb→Präsens/
Präteritum/Perfekt/Konjunktiv II, adj→Komparativ/Superlativ, adv→[]). Then validate →
install → `collect` → commit. NB the `c1-topup` dossier file must NOT be named
`dossiers.c1-3.json` (that already exists for the original C1 list) — use e.g.
`dossiers.c1-topup.json`. Waves keep tripping the Anthropic session limit near ~5 agents;
the interrupted agents had already written complete output, so always check disk + validate
before assuming a "failed" batch is lost.

**Product decision (2026-07-26):** personal vocabulary tool, *not* exam prep. **No published
lists ever.** The word list is a hand-curated pool we grow together; specific coverage
doesn't matter — only skipping known words and capturing unknown ones. Phase 5 (composite
pipeline) is abandoned.

**Pick up with one of these:**
1. **Author dossiers for the 1000-word pool** — the word entries exist; ~885 have no dossier
   yet. This is the big remaining content campaign. Proven workflow from the word-pool build:
   partition the pending words into **disjoint semantic-domain batches** (so parallel authors
   can't collide), spawn one sub-agent per batch writing `data/dossiers.*.json` (glob-loaded,
   keyed by lemma), then `npm run collect` to confirm none are missing. `npm run collect`
   already lists exactly which lemmas still need a dossier. Batch meaningfully (one file → one
   verify → one commit); dossiers are **O**-level (correctness-sensitive), unlike the word
   entries which were fine at **S**.
2. **Quality spot-check** the C1 dossiers (task 7.1) — register/Rektion/examples are unverified
   author's-German. Do metadata via a **local script** (curl Wiktionary), not per-word WebFetch
   (that burned a quota — see 2026-07-26 note below).
3. **Phase 4** — get it on the phone (Tailscale is yours; manifest + mobile polish are mine).

**Cost note (learned the hard way 2026-07-26):** verifying words via many parallel `WebFetch`
calls in a large context is extremely token-expensive. Do bulk lookups as a single local
script instead. Keep content batches meaningful (one file, one verify, one commit) rather than
many tiny turns — each turn re-pays the full context cost.

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

- [x] **2.1** `core/selection.ts` — next unoffered, unknown word at active level by frequency rank — **S**
- [x] **2.2** Session routes (`adapters/http.ts`): first-run → offer/calibrate → dossier → done,
      as server-rendered pages with Post/Redirect/Get so reloads never re-submit — **S**
- [x] **2.3** Offer + calibrate view (3 buttons; *Kenne ich* marks known and re-offers immediately) — **S**
- [x] **2.4** Dossier display view (the dense one), full design-language CSS. `Weiter` → session complete — **S**
- [ ] ~~**2.5** Anchor input~~ — cut from MVP (anchor step deferred, architecture.md §7)
- [x] **2.6** Stub dossier fixture matching the §5 schema shape — **H** · done as P.3
- [x] **2.7** Level selector (first-run picker + `/settings`, changeable anytime) — **H**
- [x] **2.8** Session complete screen — no "next word" button (§3.1, §7) — **H**
- [x] **2.9** Level-exhausted state — shown when no unknown word remains at the active level — **S**
- [ ] **2.10** *Kenne ich* micro-confirmation — functional (redirects to next word), but no
      visual acknowledgement animation yet. Polish, deferred — **H**
- [x] **2.11** Session-resume: `currentOpenSession()` resumes an open session in place
      (offer or dossier) on `GET /` — decided *resume*, not discard — **S**
- [x] **2.12** Empty-log state (log shows "Noch keine Wörter"). No-search-results N/A —
      search is disabled until Phase 6 — **H**

*This turn also built a minimal log screen (`/log`) so the session-complete exit isn't a
dead link; the full Phase 6 version (search, distinct-by-recent, level-free rows) still stands.*
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
- [x] **3.2** **Dossier authoring** — real, hand-authored dossiers for all 20 seed words
      (`data/dossiers.seed.json`): meaning, forms, Rektion, collocations, examples,
      register, near-synonym distinctions. Produced by the collection task (Claude Code),
      not an API call. Still wants a DWDS/Duden spot-check (§7.1) — **O**

### Hand-curated C1 word list (this is the model now — no published lists, see Phase 5)

- [x] **C1-list** 100 hand-curated C1 words (`data/words.c1.json`) with correct
      article/plural/key_forms. Multi-file word/dossier loading wired. Wants a Duden
      spot-check (§5.8) — **O**
- [x] **C1-dossiers** Dossiers for **all 101 C1 words** authored (7 batches,
      `data/dossiers.c1*.json`, glob-loaded). `npm run collect` reports zero missing.
      Content wants a DWDS/Duden spot-check (§7.1); genders/plurals partly Wiktionary-verified — **O**
- [x] **dossier-verification** Spot-checked all 37 noun genders/plurals against German
      Wiktionary — all correct. (Remaining metadata unchecked; do via a local script, not
      per-word web lookups, to avoid token cost.)
- [x] **3.3** The collection task (`core/collect.ts`, `npm run collect`): load authored
      dossiers into the store, work pending captures through the dedup gate, report what
      still needs content. Idempotent. No model call — content is authored by hand into
      the seed files, then loaded — **O**
- [x] **3.4** `StoredDossierSource`: reads stored dossiers from SQLite, validates on the
      way out; `null` when not built → word not offered. Selection now requires a current
      dossier (`nextSeedWord`) so no word is ever offered without one — **S**
- [ ] **3.7** "Report an error" affordance writing to `dossiers.error_report` (§11 says MVP, not later) — **H**

### Word capture (architecture.md §5b)

- [x] **3.8** `captures` table + partial unique index — done in migration 001 — **H**
- [x] **3.9** Tap-to-capture (`core/capture.ts`, `views/screens.ts`, `POST /capture`):
      every German word in collocations and examples is a tap target, marked state with
      accent underline, undo on re-tap, live "Gemerkt für später" tray. App only saves the
      tap (`pending`) — no generation. Verified server- and client-side — **S**
- [x] **3.10** Lemma resolution at capture time (`resolveSurface`) — exact-match against
      `words.lemma` with German case variants, best-effort for tray display + `word_id`
      link. Plural→singular is the collection task's job (§5b) — **S**
- [x] **3.10b** Dedup gate in the collection task (`core/collect.ts`): self-tap dismissed,
      duplicate dismissed, `known_words` retraction on re-capture, resolved-with-dossier →
      `queued`, otherwise flagged as needing an authored dossier — **S**
- [~] **3.13** Dismissal: re-tapping a marked word un-captures it (undo); the collection
      task dismisses self-taps and duplicates. The log-line dismissal (screen 6) is
      deferred to Phase 6 — **H**
- [ ] **3.14** Selection engine: captured words with `status = 'queued'` outrank
      frequency order. Deferred — no `queued` captures exist until the collection task runs — **S**

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

## Phase 5 — ~~Composite word list~~ ABANDONED

**Dropped by decision (2026-07-26).** The app is a personal vocabulary tool, not
exam prep, and will use **no published or copyrighted word lists** (Goethe, publisher,
Telc, frequency corpora). The specific vocabulary doesn't matter — only that the learner
skips words they know and captures words they don't. So there is no composite pipeline,
no source-licensing gate, and no CEFR-fidelity requirement.

The word list is simply a **hand-curated pool** we grow together (the `data/words.*.json`
files + authored dossiers, loaded by the collection task). Levels (B1/B2/C1) remain only
as a coarse starting filter the learner picks, not as a claim of official coverage.

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
