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
  id              INTEGER PRIMARY KEY,
  word_id         INTEGER NOT NULL REFERENCES words(id),
  started_at      TEXT NOT NULL,
  completed_at    TEXT,
  calibration      TEXT,                 -- know-it | vaguely | new
  anchor_completed INTEGER NOT NULL DEFAULT 0
);            -- nothing textual from the anchor step is stored at all — see §7

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

That's the whole MVP rule, and it satisfies §3.4 ("pitched just above what the user knows") because frequency rank within a level is a reasonable proxy for difficulty. Sophistication here is premature — the calibration signal from §3.5 accumulates in `known_words` for free, and after two weeks of real rejections you'll have actual data to tune against. The §9 quality metric (≤20% rejection rate) is measurable from `sessions.calibration` with a single query.

---

## 5. Dossier generation

**Cache-with-regenerate** — resolving open question §10.1. Keyed by `(word_id, schema_version)`. One LLM call per word, ever; bumping `schema_version` invalidates the corpus and a CLI regenerates.

The schema is enforced, not requested. This is the direct mitigation for §11's core risk (invented collocations, wrong register labels) — a Zod schema passed through structured outputs means the model cannot return a dossier missing a register label or with a malformed collocation list:

```ts
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Dossier = z.object({
  meaning_de: z.string(),
  meaning_en: z.string(),
  examples: z.array(z.object({ de: z.string(), en: z.string() })).min(2).max(3),
  collocations: z.array(z.object({ phrase: z.string(), gloss_en: z.string() })),
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

Adaptive thinking is worth it here — deciding whether *erörtern* is formal-only, and how it differs from *besprechen*, is exactly the judgment that benefits from reasoning. It's a one-time cost per word.

**`near_synonyms` answers open question §10.3.** Rather than branching the dossier on the "Vaguely" answer, generate the disambiguation always and surface it more prominently when calibration was *Vaguely*. One cached artifact, two presentations — no second generation path.

**Cost.** At Opus 4.8 rates ($5/$25 per MTok), a dossier of ~1.5k output tokens costs a couple of cents. A B1–C1 seed of several hundred words is a one-time spend well under $20, and thereafter sessions are free unless you regenerate. Prompt caching is *not* worth wiring up: Opus 4.8 needs a 4096-token cacheable prefix and the dossier system prompt won't reach it.

**Open question §10.4 (real-content snippets) stays open, and should.** Live retrieval and curated corpora both carry copyright exposure that a single-user local app doesn't need to take on in week one. Ship the dossier without snippets; the collocations and register note already carry most of the "context is the product" weight.

---

## 5b. Word capture and the nightly job

Tapping a word in a collocation or example (screens 2 and 7) records it as a capture.
This is a narrow slice of brief §8's bring-your-own-word feature: capture is in scope,
**on-demand dossier generation is not.**

### Why batched, not on-tap

On-tap generation fires an unbounded number of expensive calls during a session that is
supposed to last under five minutes (§9 anti-metric). Deferring instead:

- **Halves the cost.** The Message Batches API runs at 50% of standard pricing and is
  built for exactly this — asynchronous, latency-insensitive work. Most batches finish
  within an hour.
- **Bounds the spend per run** rather than per tap.
- **Keeps the session fast.** Nothing blocks on a model call mid-dossier.
- **Leaves no un-dossiered words in the list.** By the next session every capture is
  either complete or explicitly failed.

### Job stages

Run over all captures with `status = 'pending'`:

1. **Resolve lemma.** Match `surface_form` against `words.lemma` first — free and
   instant. On a miss, the model resolves it in stage 3's batch.
2. **Apply the dedup gate** (below). Most captures never reach stage 3.
3. **Assign level and source.** Captures not already in the word list get a CEFR level
   estimate and `source = 'capture'`, keeping §5's per-word provenance honest.
4. **Generate dossiers** — one batch request per surviving capture, same schema and
   prompt as §5, submitted through `client.messages.batches.create()`.
5. **Mark `queued`.** The word is now eligible for selection with its dossier already
   cached, so it opens instantly.

### Dedup gate

Resolving a lemma against `words` only answers *"is this in the word list."* Four other
checks have to run before anything is scheduled for generation:

| Case | Check | Action |
|---|---|---|
| **Self-tap** | Captured lemma equals the source session's word | Drop. Tapping `erörtern` inside its own examples is a misfire, not a signal. |
| **Duplicate capture** | An active capture with the same lemma already exists | Merge into the existing row; don't create a second. |
| **Dossier already exists** | Row present in `dossiers` at the current `schema_version` | Skip generation entirely, jump to `queued`. Paying twice for the same dossier is the exact waste batching was meant to avoid. |
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

Stage 4 means capture composes with the pre-generation design in §5: by the time a
captured word is offered, its dossier is already warm.

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

### Scheduling

**Trigger on app start when the last successful run is older than ~24h**, not on a
wall-clock cron. The host laptop sleeps (§10), so a fixed 03:00 job would simply be
missed with no catch-up. A staleness check runs whenever the machine is actually awake,
which is the only time it can run at all.

### Guards

- **Cap words per run** (~50). A tap-happy week shouldn't produce a surprise bill.
- **Per-item failure isolation.** Batch results are keyed by `custom_id` and arrive in
  any order; a failed item stays `pending` and is retried next run rather than failing
  the batch.
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

## 7. Anchor step — correctness assessment

Every sentence is novel, so nothing here is cacheable.

### Rewrite, not verdict

The obvious design — correct / unidiomatic / wrong — is a grading scale wearing a
disguise, and §4 and §7 both rule those out. Instead the model returns a rewrite and a
one-line note:

```ts
const AnchorFeedback = z.object({
  rewrite: z.string(),   // what a German would write; may equal the input
  note: z.string(),      // one sentence on what changed and why
});
```

If the rewrite is identical to the input, the UI shows *Klingt natürlich* and nothing
else. If it differs, both lines appear with the note. Feedback becomes **demonstrative
rather than evaluative** — you learn from the delta, not from a label — which is also a
closer match to "naturalness" than any verdict could be.

### Grounded in the dossier

The call receives the **cached dossier as context** — register, Rektion, collocations.
Without it, the feedback model judges the sentence from scratch and can contradict what
the learner read ninety seconds earlier: the dossier calls `erörtern` formal, and the
feedback rewrites the sentence into something colloquial. One source of truth for both,
or the app argues with itself.

It also lets the note be specific rather than generic: *"`erörtern` verlangt den
Akkusativ — `über das Thema` gehört zu `diskutieren`."*

### Model — revised

Originally specified as `effort: "low"` on the grounds that it's a small bounded task.
That was reasoning about size rather than stakes.

**The failure mode is uniquely bad: confidently correcting a sentence that was already
correct.** That doesn't waste a session, it teaches something false about German at the
moment of maximum receptiveness — and the learner has no way to overrule it, since not
having that intuition is why they're here.

So: `claude-opus-4-8`, adaptive thinking, `effort: "medium"`. Volume makes the cost
argument moot — roughly 500 input and 200 output tokens per anchor at four sessions a
week is cents per month. Economising there to save a fraction of a cent while risking
wrong German taught with confidence is a false economy.

### The main guard: bias toward leaving it alone

The dominant risk is **over-correction** — models asked to review tend to find something
to improve. The prompt must explicitly require returning the sentence unchanged unless
there is a genuine grammatical error or something a native speaker would not say.
Stylistic preference is not grounds for a rewrite.

This is the hardest part of the prompt to get right, and the reason authoring it is an
Opus task rather than a template.

### The whole step is ephemeral

**Nothing textual survives the anchor step** — not the rewrite, not the note, and not
the learner's own sentence. `sessions` records a single `anchor_completed` flag and
nothing more.

The reasoning generalises from the rewrite to the sentence. Stored corrections are one
query away from being a review list, which §7 rules out permanently. But a stored
sentence *without* its correction is worse in a different way: the log would preserve
`über das Thema erörtern` forever, uncorrected, quietly reinforcing the error it was
meant to fix. Keeping neither is the only consistent position — the anchor is a moment
of production, not an artefact.

This makes the review queue structurally impossible rather than merely a matter of
restraint. There is no table to query.

**One exception, opt-in and quarantined:** disputing a rewrite stores the full triple —
sentence, rewrite, note — in a separate `feedback_disputes` table. A dispute without
content is useless as a quality signal, and an explicit tap is explicit consent to
record that one instance. It lives outside `sessions` deliberately, so no log query can
reach it by accident.

```sql
CREATE TABLE feedback_disputes (
  id           INTEGER PRIMARY KEY,
  session_id   INTEGER REFERENCES sessions(id),
  anchor_text  TEXT NOT NULL,
  rewrite      TEXT NOT NULL,
  note         TEXT NOT NULL,
  disputed_at  TEXT NOT NULL
);
```

### Practical

- **Failure is non-fatal.** If the call errors, the word still lands in the log and
  `anchor_completed` is still set. Feedback is optional; the session record is not.
- **The §9 anchor-completion metric** reads `anchor_completed` directly.
- **The log shows words, never writing.** Screen 7 renders the dossier alone.

---

## 7b. Authentication (development)

**No API key in the project.** The Anthropic SDKs resolve credentials in a fixed order
and fall through to an OAuth profile on disk, so after a one-time `ant auth login` a
bare constructor authenticates on its own:

```ts
const client = new Anthropic();   // no apiKey argument, no .env entry
```

Resolution order, first match wins: `ANTHROPIC_API_KEY` → `ANTHROPIC_AUTH_TOKEN` →
the active OAuth profile from `ant auth login` → WIF env vars → the default profile on
disk. The profile lives under `%APPDATA%\Anthropic` on Windows.

### What this does and does not change

It removes key management. It does **not** make calls local or free — there is no local
inference endpoint, and the Claude desktop app exposes no API. Requests still go to
`api.anthropic.com`; they simply authenticate as the logged-in identity instead of via a
static key, and usage bills to whichever org and workspace the profile is scoped to.
**Confirm which workspace that is before relying on the cost profile.**

### Three traps

1. **A set `ANTHROPIC_API_KEY` silently wins over the profile** — including an *empty*
   one. `ANTHROPIC_API_KEY=""` in a `.env` still occupies its precedence slot and
   authenticates with an empty key. The variable must be genuinely absent, so it must
   not appear in `.env.example` at all.
2. **Claude Code auth conflict.** After `ant auth login`, Claude Code may report a
   conflict between the CLI profile and its own login. Keep one: `/logout` in Claude
   Code to use the profile, or `ant auth logout` to keep Claude Code's login.
3. **Refresh tokens hard-expire** — they don't slide with use. When a previously working
   setup starts failing auth, re-run `ant auth login` before debugging anything else.

`ant auth status` reports which credential source and profile actually won. That's the
first diagnostic for any auth surprise.

### Revisit when

This is a development and testing decision. Revisit once the app is polished and real
usage data exists — at that point a dedicated API key scoped to its own workspace makes
per-project cost attribution possible, which the shared profile does not.

---

## 8. Access and install

- `tailscale serve https / http://localhost:3000` → valid cert, MagicDNS name, phone reaches it anywhere.
- Add a web app manifest so it installs to the home screen.

The manifest matters more than it looks. §6 rules out notifications and §7 rules out streaks, so the home-screen icon is the *only* affordance standing between the app and the §9 primary metric (4 unprompted sessions/week). Worth doing properly in week one.

---

## 9. Build order

1. Schema + migrations + a hand-entered 20-word fixture
2. Core loop end to end with a stubbed dossier — offer, calibrate, display, anchor, log
3. Real dossier generation + cache + regenerate CLI
4. Tailscale + manifest — get it on the phone, start using it daily
5. The composite word-list pipeline
6. "Words met" log and search

Steps 1–4 make it a real product you're using; step 5 makes it a good one. Doing the pipeline first means a week of data plumbing before you know whether the loop feels right in a U-Bahn carriage.

---

## 10. Known risks

- **The laptop must be awake.** The failure mode isn't an error, it's a session that silently doesn't happen — and that's the exact behavior the primary metric measures. If §9 starts slipping, check this before concluding the product isn't sticky. Moving the Fastify app to Fly.io or a small VPS is an afternoon, and `core/` doesn't change.
- **Normalization defects surface late.** A duplicate offered under two surface forms reads as an engine bug and undermines trust in calibration. Add a build-time assertion that no two rows share a normalized key.
- **Dossier quality (§11) is the product.** Structured outputs guarantee shape, not truth. Spot-check the first 20 dossiers against DWDS before trusting the pipeline, and build the "report an error" affordance in step 3, not later.
