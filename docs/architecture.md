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
  calibration     TEXT,                  -- know-it | vaguely | new
  anchor_text     TEXT,
  anchor_feedback TEXT
);

CREATE TABLE dossiers (
  word_id        INTEGER PRIMARY KEY REFERENCES words(id),
  schema_version INTEGER NOT NULL,
  model          TEXT NOT NULL,
  generated_at   TEXT NOT NULL,
  json           TEXT NOT NULL,
  error_report   TEXT                    -- §11 "report an error" affordance
);
```

`sessions` doubles as the "Words met" log — reverse-chronological with a join to `dossiers`. No separate table, and deliberately no `next_review_at` column: §7 makes that a permanent non-goal, and leaving the column out means nobody can quietly add scheduling later.

---

## 4. Selection engine

```
next_word = the highest-frequency word at the active level
            that is not in known_words
            and has not already been offered
```

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

## 7. Anchor step

A second, cheaper call — no caching (every sentence is novel), no schema, `effort: "low"` for a fast turnaround. §4 specifies brief feedback on naturalness, single attempt, no grading scale, so the prompt should be tightly scoped: what a German speaker would say differently, and why. One short paragraph.

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
