# Ein Wort — Screens & States

**Status:** In design review · **Last updated:** 2026-07-20 · Companion to [architecture.md](architecture.md), [plan.md](plan.md)

Mobile-first throughout. Sessions happen on a phone, one-handed, in a U-Bahn
carriage (brief §6). Nothing here should require two hands or a landscape turn.

---

## Design review tracker

Screens are sketched and approved one at a time as passive HTML — no transitions,
no interactivity. Resume from the first row that isn't ✅.

| # | Screen | Status |
|---|---|---|
| 1 | Offer + Calibrate | ✅ Approved |
| 2 | Dossier | ✅ Approved |
| ~~3~~ | ~~Anchor prompt~~ | Cut from MVP — anchor step deferred (architecture.md §7) |
| ~~4~~ | ~~Anchor feedback~~ | Cut from MVP — anchor step deferred (architecture.md §7) |
| 5 | Session complete | ✅ Approved |
| 6 | Words met (log) | ✅ Approved |
| 7 | Log detail | ✅ Approved |
| ~~8~~ | ~~Search~~ | Merged into screen 6 as a state |
| 9 | Level selector | ✅ Approved |
| 10 | First run | ✅ Approved |

**MVP is seven screens.** The core loop is offer/calibrate → dossier → done; screens 3
and 4 (the anchor step) were designed and approved, then cut from MVP when no fast,
reliable local feedback proved possible (architecture.md §7). Their approved design is
kept below for when the step returns. The states table is not sketched — those are
implementation-time decisions against the design language in the next section.

Legend: ⬜ not started · 🔵 in review · ✅ approved

---

## Core loop screens

### 1. Offer + Calibrate

One screen, not two. Brief §4 lists offer and calibrate as separate steps, but the
question *"do you know this word?"* is already implied by seeing the word — making the
user tap twice to reach it adds a step to a 3-minute session for no information gain.

Contains: the word with article + plural (nouns) or key forms (verbs); three buttons —
*Know it* / *Vaguely* / *New to me*.

**Approved 2026-07-20.** Decisions locked by that review:

- **No progress indicator of any kind** — no counter, no "word 3 of 20", no remaining-words
  figure. A progress bar is a streak with better manners; §7 rules it out.
- **Interface copy is in German.** English chrome inserts a translation step into a tool
  whose premise is staying inside the language.
- **Three stacked full-width buttons** (46px), bottom third of the screen, one-handed
  reach. A horizontal row would give the three options very different tap ergonomics
  despite equal weight.
- **Serif for the word, mono for the principal parts.** The word is the object of study;
  the forms are reference data.
- Deliberately absent: escape hatch, source/frequency metadata, words-remaining count.

### 2. Dossier

The dense one. This screen is why §6 chose a web app over a chat bot — it is a small
document, not a message.

Contains: meaning (DE + EN), 2–3 example sentences, top collocations, register note
(formal / neutral / colloquial / regional), near-synonym distinctions, and the
"report an error" affordance (§11 puts this in the MVP, not later).

When calibration was *Vaguely*, the near-synonym block is surfaced more prominently —
same cached artifact, different presentation. This is the resolution of open question
§10.3.

**Revised in review:**

- **Collocations come before examples.** You meet the pattern, then notice it working in
  a sentence — the two reinforce instead of competing.
- **Formen block** — Präsens / Präteritum / Perfekt / Konjunktiv II. Open: whether weak
  verbs show the full block or a single `regelmäßig` marker, since their forms are
  derivable. Nouns show declension (genitive singular + plural) in the same slot.
- **Rektion block** — valency patterns with case tags (`Akk.`, `Akk. + Dat.`), carrying
  the screen's only accent color. This is the block that enables production rather than
  mere recognition.
- **`Weiter` ends the session.** With the anchor step cut (screens 3–4, architecture.md
  §7), the dossier's button goes straight to session complete (screen 5). The MVP loop
  is offer/calibrate → dossier → done.
- **Word capture** — any word in the collocations or examples is a tap target. Tap to
  mark, tap again to undo; only marked words get visual treatment, so no dotted
  underlines litter the screen. Marked words appear lemmatized in a "Gemerkt für später"
  tray (tapping `Ausschuss` in context yields `der Ausschuss`).

Tap rather than text selection: mobile selection means OS magnifiers, drag handles, and
a system context menu that can't be reliably hooked on iOS Safari. The dossier is
otherwise a passive page, so every word can simply be a tap target.

Dossiers for captured words are built by the scheduled collection task, not on tap — see
architecture.md §5b.

### 3 & 4. Anchor prompt + feedback — CUT FROM MVP

**Designed and approved 2026-07-20, then cut from MVP scope** (architecture.md §7): the
step is only worth having with fast, reliable feedback, and no in-budget local model on
this machine delivered both (gemma4 accurate but 65–90 s/check; mistral-nemo slower still
and it misdiagnosed a correct sentence). The app makes no API calls, so there was no other
source. Deferred to post-MVP; the dossier's `Weiter` now goes straight to session complete.

The approved design, preserved for when the step returns:

- **Anchor prompt** — free-text, single attempt, serif input (writing, not form-filling);
  a real, unapologetic skip (skipping mustn't feel like failing); the Rektion pattern kept
  visible; no counter or sentence-count enforcement.
- **Anchor feedback** — rewrite plus one-line note, never a verdict; no red pen (hierarchy,
  not strikethrough); *"Ein Deutscher würde schreiben"*, not "Besser"; the unchanged state
  bare (*Klingt natürlich*, no praise); the whole step ephemeral, nothing stored.

### 5. Session complete

**Approved 2026-07-20.** Deliberately a dead end.

- **There is no button.** Every other screen ends in a full-width primary action; this
  one ends in a quiet link to the log and empty space. §3.1 ends the session when the
  word is anchored; §7 rules out volume maximisation.
- **Left-aligned, top-anchored, not centred.** Centred read as a success screen — the
  visual grammar of celebration. Same alignment as every other screen keeps it
  matter-of-fact.
- **No count, no total, no weekly tally.** Each is a streak in disguise.
- **The captured-words block earns its place** by answering "what happened to the words I
  tapped?" and showing the queue is real. `Kommen in den nächsten Tagen dran` is vague on
  purpose — captures are collected when you next schedule the Claude Code task (§5b), not
  on a timer.
- *"steht jetzt in deinen Wörtern"* is a deliberately weak claim. Not *gelernt* — the app
  can't know that, and flattery would be obvious.

---

## Log screens

### 6. Words met

A record, not a queue (§4). Contains: search field, a line noting captured words
awaiting their turn, and the three most recent words with their meanings.

**Revised in review:**

- **Only the three most recent words are listed, with no dates and no grouping.** A
  scrollable history invites browsing-as-studying — the review queue returning as a user
  habit rather than a feature. Three words plus search makes this a lookup tool.
- **Search is the only route to older words**, so its placeholder reads
  `Alle Wörter durchsuchen` — otherwise three rows read as "the app remembers three
  words."
- **Search covers met words only.** Captured and queued words haven't been learned, so
  they are not history and are excluded from both the list and the results. They also
  have no dossier until collection runs, so a result would open onto nothing.
- **No level indicator per row, and none in this screen's header.** `level`, `source` and
  `frequency_rank` are engine data: they drive selection and are versioned like code
  (§5), but the learner never sees them. The active-level badge stays on the session
  screens (1, 5), where what you're being served is relevant.
- **No counts of any kind** — no total, no per-week tally. Week grouping is chronology; a
  number beside it is a score.
- **Nouns keep their article** (`die Gepflogenheit`), since a stripped headword teaches
  the wrong form on every scan.

**The captured-words line stays, as a diagnostic.** It is the one element on this screen
that isn't history, kept deliberately: it's the visible signal for whether collection is
keeping up (architecture.md §5b). If the number climbs run over run, you haven't scheduled
the collection task recently — it's a reminder to, not an automated promise.

For that to work it must **count `pending` captures only** — those not yet collected.
Words already at `queued` have their dossiers built and are waiting on *you* to do a
session, so counting them would make the number grow during any normal busy week and
produce a false alarm. Counting the wrong status turns the diagnostic into noise.

Session dates are still recorded in `sessions` and remain queryable for the §9 metrics —
they are simply never displayed. You can check whether the product is working without
the app reporting your cadence back at you.

### 7. Log detail

A previously-met word's dossier, re-read. Since the anchor step stores nothing
(architecture.md §7), this is the dossier alone.

**Revised in review:**

- **One template, two entry points.** Identical to screen 2 with the `Weiter` button and
  level chrome removed and a back link added — a flag on one partial, not a second
  template that drifts.
- **All four verb forms always show**, including Konjunktiv II and including regular
  verbs. Predictable placement beats brevity: a block that appears only for irregular
  verbs makes the layout shift word to word, and you read this half-asleep. *Settles the
  question left open on screen 2.*
- **Word capture works here too.** Re-reading is a plausible moment to notice something
  unfamiliar — arguably more so than the first pass, when attention was on the headword.
- **`Kenne ich doch nicht`** returns the word to the pool. Deliberately weighted above
  `Fehler melden` (14px `text-secondary` vs 12px muted): one is about your learning, the
  other about data quality. Mechanics in architecture.md §5b.
- **`Fehler melden` stays** — errors surface on the second encounter, once the word has
  settled and something reads oddly.

**The history area is a cul-de-sac by design.** Nothing in the log leads into a session;
starting one is only possible from the app's entry point. Browsing must not slide into
studying.

---

## System screens

### 9. Level selector

B1 / B2 / C1. Changeable anytime (§6). Reached from the gear on screen 6.

**Revised in review:**

- **Each level describes the language, not the label** — *Anspruchsvolle Texte, feine
  Nuancen, gehobene Sprache*. Bare `B1 / B2 / C1` assumes you remember where you sit on
  a framework you last met in a course years ago.
- **A tap selects and saves.** No `Speichern`, no confirmation — it's a preference, and
  reversible in one tap.
- **`Ändert nur, welche Wörter du künftig bekommst. Deine Wörter bleiben.`** answers the
  question that would otherwise stop you switching.
- **Only three levels.** No A1/A2, no C2, no greyed-out options implying future support —
  the screen shows exactly what the word list can serve (§6).

**Changing level does not touch the queue.** Anything already captured or queued stays
queued, at whatever level it was flagged. Level governs what the *engine* proposes;
captures are what *you* asked for, and the engine has no business overruling that. The
visible consequence is that after a downshift you may still be offered the occasional
higher-level word you flagged yourself — correct behaviour, and worth remembering when
it looks like a bug.

### 10. First run

**Approved 2026-07-20.**

- **One question, one button.** No carousel, no feature tour, no account, no email, no
  permissions prompt. The app asks the single thing it can't infer, then gets out of the
  way.
- **B2 is preselected** — the target user is B2+ (§2), and it avoids a disabled button on
  an empty selection. One tap to start.
- **The tagline is the brief's own line, in German:** *Ein Wort pro Sitzung. Gelernt in
  seinem natürlichen Umfeld, nicht auf einer Karteikarte.* Thesis and anti-thesis in one
  breath; the only place the app explains itself.
- **`Lässt sich jederzeit ändern`** removes the weight from a choice that feels
  consequential only because you're making it cold.
- **The only primary button outside a session**, justified as a threshold. Screens 5 and
  7 look bare by deliberate contrast, not inconsistency.

---

## Design language

Cross-cutting rules established across the ten reviews. These are the constraints an
implementation brief should carry.

**Layout.** Mobile-first, ~340px content column. Sections divided by 0.5px hairlines and
12px muted labels — never by nested cards.

**Typeface carries meaning:**

| Face | Used for |
|---|---|
| Serif (`--font-voice`) | German content — headwords, examples, valency patterns |
| Mono | Reference data — verb forms, case tags |
| Sans | Interface chrome — labels, buttons, glosses |

English glosses are always smaller and more muted than the German they translate, so the
eye reaches for the German first.

**Accent colour appears exactly twice** in the whole app: Rektion case tags, and
captured-word marks. Nothing else may claim it — its scarcity is what makes both legible
at a glance.

**Buttons signal direction.** A full-width 46px primary button means the session moves
forward (offer/calibrate → dossier → done). History screens (5, 6, 7) end in quiet text
links instead — the absence of a button is how a dead end is expressed. First run is the
single exception.

**Never displayed:** counts, totals, streaks, progress indicators, dates in the log,
per-word CEFR levels, scores, grades, or praise. `level`, `source` and `frequency_rank`
are engine data. Session dates stay queryable for §9 metrics but never surface.

**Interface copy is German throughout,** including structural labels. Claims stay weak
and checkable — *steht jetzt in deinen Wörtern*, never *gelernt*.

---

## States

Cross-cutting states that need designing, not just screens. These are the ones
otherwise discovered one at a time during implementation.

| State | Screen | Notes |
|---|---|---|
| Dossier missing | — | Never surfaces: a word with no stored dossier isn't offered (architecture.md §5). Dossiers are pre-built and read from storage, so there's no in-app generation, no spinner, no failure state. |
| Know it → next word | 1 | A transition, not a screen. Rapid rejection with no acknowledgement reads as broken — needs a micro-confirmation. |
| Level exhausted | 1 | No unknown words remain at the active level. Guaranteed with the 20-word fixture, so build it in Phase 2 rather than hitting a crash. |
| Session resumed | any | App closed mid-dossier, reopened later. Resume in place or discard — needs a decision. |
| Empty log | 6 | Before the first completed session. |
| No search results | 6 | Search is a state of the log screen. |
| Error report submitted | 2, 7 | Confirmation for the §11 affordance. |
| Server unreachable | all | The laptop-asleep case — see below. |

---

## One decision that shapes the screens

There's no loading state to design: dossiers are pre-built and read from storage
(architecture.md §5), so a session opens instantly or the word isn't offered. The app
makes no model calls at runtime, so there is no spinner and no generation-failure state.

### Server unreachable needs a decision

When the laptop is asleep there is no server to render a friendly message — the phone
gets the browser's error page, which reads as *"this app is broken"* rather than
*"your laptop is closed."* Given that the laptop-asleep case is the main threat to the
§9 primary metric, that misattribution is expensive.

A minimal service worker serving a static shell would fix it. Arguably this is not the
"offline mode" that §6 rules out — it caches no content and enables no sessions — but
it is adjacent enough to flag rather than assume. **Open, pending a call.**
