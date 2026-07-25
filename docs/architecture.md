# Ein Wort — Architecture

**Status:** Draft · **Last updated:** 2026-07-20 · Companion to `product-brief.md` v0.1

---

## 1. Decisions locked

| Decision | Choice | Rationale |
|---|---|---|
| Delivery | Local web app, reached from phone over Tailscale | Full control of dossier typography (§4 step 3 is a dense document, not a chat message) |
| Runtime | Node 22 + TypeScript | Already installed; no Docker/Python on this machine |
| Server | Fastify + server-rendered HTML + htmx | No frontend build step, no client state, mobile-friendly by default |
| Store | SQLite via `better-sqlite3` | Single file, trivially backed up, synchronous API is ideal for one user |
| LLM | Anthropic SDK (`@anthropic-ai/sdk`), `claude-opus-4-8` | Register and collocation judgments are the core quality risk (§11) — this is not the place to economize |
| Word list | Full composite build pipeline (§5) | Chosen explicitly; the largest single chunk of work in the MVP |

**The reachability answer:** a Tailscale tailnet. The phone joins it, `tailscale serve` provides valid HTTPS with MagicDNS, and it works over mobile data. Free for one user. The constraint this does *not* solve is that the laptop must be awake — see §10.

---

## 2. Repo layout

```
src/
  core/                  ← knows nothing about HTTP
    selection.ts         ← next word given level + known-set
    dossier.ts           ← word → validated dossier, cached
    anchor.ts            ← user sentence → naturalness feedback
    store.ts             ← SQLite access
  adapters/
    http.ts              ← Fastify routes + htmx fragments
  views/                 ← HTML templates
data/
  build/                 ← word-list pipeline (§6)
  words.seed.json        ← committed build artifact
migrations/
```

The `core/` boundary is the same instinct the brief shows in §8 about not hard-coding German — one layer up. It also means the v2 "bring-your-own-word" feature is a new entry point into `dossier.ts`, not a rewrite.

---

## 3. Data model

```sql
CREATE TABLE words (
  id             INTEGER PRIMARY KEY,
  lemma          TEXT NOT NULL,
  pos            TEXT NOT NULL,          -- noun | verb | adj | adv | ...
  article        TEXT,                   -- der/die/das, nouns only
  plural         TEXT,
  key_forms      TEXT,                   -- JSON: verb principal parts etc.
  level          TEXT NOT NULL,          -- B1 | B2 | C1
  source         TEXT NOT NULL,          -- goethe-b1 | aspekte-b2 | telc-c1 | freq
  frequency_rank INTEGER,
  list_version   TEXT NOT NULL,          -- §5: level assignments versioned like code
  UNIQUE (lemma, pos)
);

CREATE TABLE known_words (
  word_id   INTEGER PRIMARY KEY REFERENCES words(id),
  marked_at TEXT NOT NULL,
  via       TEXT NOT NULL                -- know-it | session-complete
);

CREATE TABLE sessions (
  id           INTEGER PRIMARY KEY,
  word_id      INTEGER NOT NULL REFERENCES words(id),
  started_at   TEXT NOT NULL,
  completed_at TEXT,
  calibration  TEXT                      -- know-it | vaguely | new
);            -- the anchor step is out of MVP scope (§7), so nothing from it is stored

CREATE TABLE dossiers (
  word_id        INTEGER PRIMARY KEY REFERENCES words(id),
  schema_version INTEGER NOT NULL,
  model          TEXT NOT NULL,
  generated_at   TEXT NOT NULL,
  json           TEXT NOT NULL,
  error_report   TEXT                    -- §11 "report an error" affordance
);

CREATE TABLE captures (
  id           INTEGER PRIMARY KEY,
  surface_form TEXT NOT NULL,            -- as tapped, e.g. "Vorschläge"
  lemma        TEXT,                     -- resolved, e.g. "Vorschlag"
  word_id      INTEGER REFERENCES words(id),  -- NULL if not in the word list
  session_id   INTEGER REFERENCES sessions(id),
  captured_at  TEXT NOT NULL,
  status       TEXT NOT NULL             -- pending | resolved | queued | offered | dismissed
);
```

`sessions` doubles as the "Words met" log — reverse-chronological with a join to `dossiers`. No separate table, and deliberately no `next_review_at` column: §7 makes that a permanent non-goal, and leaving the column out means nobody can quietly add scheduling later.

---

## 4. Selection engine

```
next_word = the oldest capture with status = 'queued'
            ── otherwise ──
            the highest-frequency word at the active level
            that is not in known_words
            and has not already been offered
```

Captured words outrank frequency order. A word you noticed and flagged yourself is
better evidence of a gap than a frequency rank is — that's §3.5's calibration principle
applied in the other direction.

**The active level filters the second branch only.** Captures are never re-filtered by
level: whatever was flagged stays queued at whatever level it was flagged. Level governs
what the engine *proposes*; a capture is what the learner *asked for*, and the engine
doesn't overrule that. After a downshift this surfaces as the occasional higher-level
word still appearing — correct, not a bug.

That's the whole MVP rule, and it satisfies §3.4 ("pitched just above what the user knows") because frequency rank within a level is a reasonable proxy for difficulty. Sophistication here is premature — the calibration signal from §3.5 accumulates in `known_words` for free, and after two weeks of real rejections you'll have actual data to tune against. The §9 quality metric (≤20% rejection rate) is measurable from `sessions.calibration` with a single query.

---

## 5. Dossier generation — built offline, read at runtime

**The app never generates a dossier.** Dossiers are built ahead of time by a Claude Code
task (run on a schedule you set — see §5b) and stored; the app only ever reads them,
keyed by `(word_id, schema_version)`. Consequence: **the app makes no model API calls and
needs no Anthropic credential at all.** A word with no stored dossier is simply not
offered yet.

This is the resolution of open question §10.1 (cached vs. fresh) taken to its end: not
cached-on-first-use, but pre-built. Bumping `schema_version` invalidates the corpus and
the task rebuilds it.

The schema is still enforced, not requested — the mitigation for §11's core risk
(invented collocations, wrong register labels) is a Zod schema passed through structured
outputs, so a dossier can't come back missing a register label or with a malformed
collocation list. The generation call runs **in the scheduled task, not the app**:

```ts
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Dossier = z.object({
  meaning_de: z.string(),
  meaning_en: z.string(),
  forms: z.array(z.object({ label: z.string(), value: z.string() })),      // Formen block; verb conjugation or noun declension
  rektion: z.array(z.object({ pattern: z.string(), cases: z.string() })),  // Rektion block; [] for words that take no object
  collocations: z.array(z.object({ phrase: z.string(), gloss_en: z.string() })),
  examples: z.array(z.object({ de: z.string(), en: z.string() })).min(2).max(3),
  register: z.enum(["formal", "neutral", "colloquial", "regional"]),
  register_note: z.string(),
  near_synonyms: z.array(z.object({ lemma: z.string(), distinction: z.string() })),
});

const response = await client.messages.parse({
  model: "claude-opus-4-8",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  output_config: { format: zodOutputFormat(Dossier) },
  messages: [{ role: "user", content: prompt(word) }],
});
```

Adaptive thinking is worth it here — deciding whether *erörtern* is formal-only, and how it differs from *besprechen*, is exactly the judgment that benefits from reasoning. It's a one-time cost per word, paid in the scheduled task.

**`near_synonyms` answers open question §10.3.** Rather than branching the dossier on the "Vaguely" answer, generate the disambiguation always and surface it more prominently when calibration was *Vaguely*. One stored artifact, two presentations — no second generation path.

**In development, the app reads fixtures instead of stored dossiers** (§7b) — so the whole loop runs before a single real dossier exists.

**Open question §10.4 (real-content snippets) stays open, and should.** Live retrieval and curated corpora both carry copyright exposure that a single-user local app doesn't need to take on in week one. Ship the dossier without snippets; the collocations and register note already carry most of the "context is the product" weight.

---

## 5b. Word capture and dossier collection

Tapping a word in a collocation or example (screens 2 and 7) records it as a capture.
This is a narrow slice of brief §8's bring-your-own-word feature: capture is in scope,
**on-demand dossier generation is not.**

### The app saves; a scheduled Claude Code task collects

The app's only job at capture time is to **save the tap** (`status = 'pending'`) and
move on. There is no in-app automation, no batch queue, no background job — the earlier
nightly-job design (Message Batches API, staleness-triggered cron, per-run caps) is
**dropped.** It required the app to hold an API credential and to run unattended work on
a laptop that sleeps; both problems vanish if the app simply never generates anything.

Instead, dossier collection is a **Claude Code task you schedule** (a routine, or an
ad-hoc "go through the queue" request). When it runs, Claude — with full reasoning, not a
constrained in-app call — works the pending captures and writes finished dossiers back to
the store. You control the cadence; nothing depends on the laptop being awake at 3am.

### What the collection task does

Over all captures with `status = 'pending'`:

1. **Resolve lemma.** Match `surface_form` against `words.lemma`; resolve misses directly.
2. **Apply the dedup gate** (below). Most captures never reach step 4.
3. **Assign level and source.** Captures not already in the word list get a CEFR level
   estimate and `source = 'capture'`, keeping §5's per-word provenance honest.
4. **Build the dossier** — same schema as §5, written to the `dossiers` store.
5. **Mark `queued`.** The word is now eligible for selection with its dossier already
   built, so it opens instantly.

The same task builds dossiers for the seed word list (§6) — collection and seeding are
one mechanism, run by Claude on demand rather than by the app on a timer.

### Dedup gate

Resolving a lemma against `words` only answers *"is this in the word list."* Four other
checks have to run before anything is scheduled for generation:

| Case | Check | Action |
|---|---|---|
| **Self-tap** | Captured lemma equals the source session's word | Drop. Tapping `erörtern` inside its own examples is a misfire, not a signal. |
| **Duplicate capture** | An active capture with the same lemma already exists | Merge into the existing row; don't create a second. |
| **Dossier already exists** | Row present in `dossiers` at the current `schema_version` | Skip generation entirely, jump to `queued`. Building the same dossier twice is pure waste. |
| **Already met** | Lemma appears in a completed `sessions` row | Don't re-offer as new. Surface the existing log entry instead — you've seen it before and the app should say so. |
| **Marked known** | Lemma is in `known_words` | **Remove it from `known_words`,** then queue. |

That last row is the interesting one. Tapping a word you previously answered *Kenne ich*
on is direct evidence the earlier answer was wrong — so capture becomes bidirectional
calibration rather than one-way. §3.5 treats a rejection as signal; this treats the
retraction of one the same way. Without it, any word you once over-claimed is permanently
unreachable, because the selection engine filters `known_words` out.

Enforce the duplicate case in the schema, not just in the job:

```sql
CREATE UNIQUE INDEX captures_active_lemma
  ON captures (lemma)
  WHERE status IN ('pending', 'resolved', 'queued');
```

By the time a captured word is offered, the collection task has already built and stored
its dossier — so it opens instantly, same as any seed word.

### Retraction: *"Kenne ich doch nicht"*

Screen 7 offers a way to take a met word back. Completing a session writes to
`known_words` with `via = 'session-complete'`, so a word you've met is filtered out of
future selection exactly like one you dismissed. Retraction reverses that:

1. Delete the `known_words` row.
2. Insert a capture for the lemma.

That's the whole implementation — **it reuses the capture machinery unchanged.** The
dedup gate already handles this exact shape: the dossier exists at the current
`schema_version`, so generation is skipped and the capture goes straight to `queued`.
No new path, no second queue, no extra table.

It also completes the calibration story. There are now three ways the model of your
vocabulary gets corrected, and all three are user-initiated:

| Signal | Meaning |
|---|---|
| *Kenne ich* on screen 1 | I know this — don't offer it |
| Tapping a word in a dossier | I don't know this — offer it |
| *Kenne ich doch nicht* on screen 7 | I thought I knew this, but I don't |

The third is the most informative of the three, because it's the only one grounded in
having actually studied the word and still not retained it.

**Consequence for the log:** a word can now have more than one completed session, so the
log lists **distinct words by most recent session**, not raw session rows. Otherwise a
retracted-then-remet word appears twice.

**Confirmation, not undo.** The action replaces itself inline with a quiet
*Kommt wieder dran* rather than opening a dialog. It's cheap to reverse — the word simply
comes round again — so a confirmation step would cost more than the mistake.

### Scheduling and observability

You decide when collection runs — a scheduled Claude Code routine, or an ad-hoc request.
Because nothing is automated, the **pending-capture count on screen 6 is the health
signal**: if it climbs run over run, collection hasn't happened recently and you schedule
it. That count is `status = 'pending'` only — words already `queued` have dossiers and are
just waiting on you to do a session, so counting them would produce a false alarm.

### Guards

- **The collection task is idempotent.** A capture that isn't finished stays `pending`
  and is picked up next run; re-running is always safe.
- **Dismissal path.** Captures can be dropped without ever being offered — a tap is a
  cheap gesture and should stay reversible.

---

## 6. Word-list build pipeline

The chosen path, and the part most likely to consume the first weekend.

```
data/build/
  01-extract-goethe.ts     ← B1 PDF → {lemma, pos, article, plural}
  02-extract-publisher.ts  ← B2/C1 publisher + Telc lists
  03-normalize.ts          ← the hard part (below)
  04-dedupe.ts             ← against the A1–B1 base
  05-rank.ts               ← join frequency data
  06-emit.ts               ← → words.seed.json
```

**Normalization is where the work actually is**, not extraction. Sources disagree on surface form in ways that break naive deduplication:

- Verbs listed as infinitive vs. with principal parts vs. with separable prefix split (`anrufen` / `ruft an`)
- Nouns with or without article, singular vs. plural headword
- Reflexives (`sich erinnern` vs. `erinnern`)
- Multi-word entries and orthographic variants (ß/ss)

Budget the majority of pipeline time here. A wrong normalizer produces a list that looks fine and silently offers you the same word twice under different surface forms.

**Licensing (open question §10.2).** The cleanest answer: **commit the build script and the derived `words.seed.json`, but not the raw source PDFs.** Every row carries its `source` field, which does the attribution work per-word. Before publishing the repo, verify the actual license terms of each non-Goethe source — publisher vocabulary lists and frequency corpora (DeReWo and similar) have varying and sometimes non-commercial terms, and I'd want that confirmed against the real license text rather than assumed.

---

## 7. Anchor step — deferred to post-MVP

The brief's §4 step 4 (write a sentence, get naturalness feedback) is **out of MVP
scope.** The MVP core loop is: offer/calibrate → dossier → done. Screens 3 and 4 leave
the MVP with it.

### Why it's out

The step is only worth having if feedback is fast *and* reliable, and neither holds:

- **The app makes no API calls** (§7b), so the only in-app option was a local model via
  Ollama. Benchmarked on this machine (2026-07-25): `gemma4` gave good, correctly-explained
  German corrections but took **65–90 s per check** — far too slow for a step in a
  sub-five-minute session (§9 anti-metric). `mistral-nemo` was worse on both counts: ~390 s
  per call, and it *misdiagnosed* a correct rewrite (called a superfluous preposition a
  "missing article"). The machine is CPU-bound; no in-budget model clears both bars.
- A confidently wrong correction is the **uniquely bad** failure — it teaches false German
  at the moment of maximum receptiveness, and the learner can't overrule it, since not
  having that intuition is why they're here. Better no feedback than unreliable feedback.

So the step doesn't earn its place in the MVP. Removing it also deletes real complexity:
no `anchor_completed` column, no `feedback_disputes` table, no dispute affordance, and the
§9 anchor-completion metric drops.

### The design, preserved for when it returns

When revisited (faster hardware, or an API credential), the design already settled in
review is: a **rewrite plus a one-line note, never a verdict** (correct/wrong is a grading
scale, which §7 rules out); the rewrite equals the input when the sentence is fine
(*Klingt natürlich*); the model is **biased hard toward leaving the sentence alone**;
the **dossier is passed as context** so feedback can't contradict what was just taught;
and the **whole step is ephemeral** — nothing textual is ever stored, which is what keeps
a review queue structurally impossible (§7 non-goals). That bar — reliable enough not to
teach false German — is exactly what the local benchmark failed to clear.

---

## 7b. Model access — the app makes no API calls

The app never calls a model at runtime. Dossiers are pre-built by the scheduled
collection task (§5, §5b) and read from storage; the anchor step, the only other model
consumer, is out of scope (§7). **The running app therefore needs no Anthropic credential
of any kind** — no key, no token, no Ollama. This dissolves the entire authentication
problem rather than deferring it.

### The subscription path is a dead end (investigated 2026-07-25)

An earlier plan tried to authenticate the app via the local Claude subscription (`claude
setup-token`). Recorded here so it isn't re-attempted: `setup-token` emits **no portable
token** — it writes a Pro-subscription OAuth credential into Claude Code's private store
for Claude Code's own use. Consuming it would mean reading that store (**blocked by the
safety classifier**, correctly), injecting a beta header the SDK doesn't send, and
handling an **~8-hour expiry** with no env-var refresh. A subscription is not an API
credential. It's also moot now: the app calls nothing.

### The dossier source (dev vs. real)

`core/dossier/` defines a `DossierSource` — `get(word) → Dossier | null` — with two
implementations:

| Source | When | Needs |
|---|---|---|
| `FixtureDossierSource` | Default. Development, the whole loop, tests, demos. | nothing |
| Stored source | Real content, once dossiers exist in the store. | the SQLite store (Phase 1) |

Neither reads a network. `null` means "not built yet" — the word simply isn't offered.
The seam is the same one the collection task writes *into*: Claude builds dossiers offline
and stores them; the app reads them back. In dev, fixtures stand in so the loop runs
before any real dossier exists.

### Where the credential actually lives

Only the **offline collection task** (§5b) uses Claude, and it runs *as Claude Code* —
your existing session — not as the app. There is no `ANTHROPIC_API_KEY` in the project,
no `.env` credential, nothing to rotate or leak. The one remaining relevance of API
billing is the brief's cost-attribution question, which is now trivial: the app's runtime
cost is zero, and collection cost is whatever your scheduled Claude Code runs consume.

---

## 8. Access and install

- `tailscale serve https / http://localhost:3000` → valid cert, MagicDNS name, phone reaches it anywhere.
- Add a web app manifest so it installs to the home screen.

The manifest matters more than it looks. §6 rules out notifications and §7 rules out streaks, so the home-screen icon is the *only* affordance standing between the app and the §9 primary metric (4 unprompted sessions/week). Worth doing properly in week one.

---

## 9. Build order

1. Schema + migrations + a hand-entered 20-word fixture
2. Core loop end to end on fixtures — offer, calibrate, dossier, done (no anchor; §7)
3. The dossier collection task: pending captures → stored dossiers, run as Claude Code
4. Tailscale + manifest — get it on the phone, start using it daily
5. The composite word-list pipeline
6. "Words met" log and search

Steps 1–4 make it a real product you're using; step 5 makes it a good one. Doing the pipeline first means a week of data plumbing before you know whether the loop feels right in a U-Bahn carriage.

---

## 10. Known risks

- **The laptop must be awake.** The failure mode isn't an error, it's a session that silently doesn't happen — and that's the exact behavior the primary metric measures. If §9 starts slipping, check this before concluding the product isn't sticky. Moving the Fastify app to Fly.io or a small VPS is an afternoon, and `core/` doesn't change.
- **Normalization defects surface late.** A duplicate offered under two surface forms reads as an engine bug and undermines trust in calibration. Add a build-time assertion that no two rows share a normalized key.
- **Dossier quality (§11) is the product.** Structured outputs guarantee shape, not truth. Spot-check the first 20 dossiers against DWDS before trusting the pipeline, and build the "report an error" affordance in step 3, not later.
