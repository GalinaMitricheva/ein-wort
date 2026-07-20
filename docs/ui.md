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
| 3 | Anchor prompt | ✅ Approved |
| 4 | Anchor feedback | ✅ Approved |
| 5 | Session complete | ✅ Approved |
| 6 | Words met (log) | 🔵 In review |
| 7 | Log detail | ⬜ Not started |
| ~~8~~ | ~~Search~~ | Merged into screen 6 as a state |
| 9 | Level selector | ⬜ Not started |
| 10 | First run | ⬜ Not started |

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
  recognition, which is what the anchor step asks for two screens later.
- **Word capture** — any word in the collocations or examples is a tap target. Tap to
  mark, tap again to undo; only marked words get visual treatment, so no dotted
  underlines litter the screen. Marked words appear lemmatized in a "Gemerkt für später"
  tray (tapping `Ausschuss` in context yields `der Ausschuss`).

Tap rather than text selection: mobile selection means OS magnifiers, drag handles, and
a system context menu that can't be reliably hooked on iOS Safari. The dossier is
otherwise a passive page, so every word can simply be a tap target.

Dossiers for captured words are built by the nightly batch job, not on tap — see
architecture.md §5b.

### 3. Anchor prompt

Free-text input, single attempt. **Approved 2026-07-20.**

- **Skip is a real option, not a fire escape** — 14px `text-secondary`, centred under the
  primary button. An 11px muted link would make skipping feel like failing, and the ≥70%
  completion metric (§9) would measure guilt rather than engagement.
- **The Rektion pattern stays visible** above the input. The anchor is acquisition, not
  assessment (§7 rules out grading), so there's no reason to withhold the one fact that
  makes a correct sentence possible.
- **What you type is set in serif** — writing, not form-filling.
- No character counter, no word limit, no sentence-count enforcement: all grading
  machinery in disguise.
- Open: don't autofocus (the keyboard would cover the skip); empty submit behaves as
  skip rather than raising a validation error.

### 4. Anchor feedback

**Approved 2026-07-20.** Two states — rewrite, or unchanged.

- **No red pen.** No strikethrough, no error colour, no inline diff. Your sentence sits
  in `text-secondary`, the native version larger in `text-primary`; hierarchy carries the
  message without marking anything wrong.
- **"Ein Deutscher würde schreiben"**, not "Besser" or "Korrekt" — demonstrative, not
  evaluative. A comparative smuggles the scale back in.
- **The delta is deliberately not highlighted**, because accent underline is reserved for
  word capture. Words in the rewrite are themselves tappable for capture.
- **The unchanged state is bare** — sentence, *Klingt natürlich*, done. No checkmark, no
  praise, no badge: all reward mechanics (§7).
- *"Das war Absicht"* appears only when there is a rewrite to dispute.

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
  purpose — the nightly job only runs when the laptop is awake.
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
  have no dossier until the nightly job runs, so a result would open onto nothing.
- **No level indicator per row, and none in this screen's header.** `level`, `source` and
  `frequency_rank` are engine data: they drive selection and are versioned like code
  (§5), but the learner never sees them. The active-level badge stays on the session
  screens (1, 3, 5), where what you're being served is relevant.
- **No counts of any kind** — no total, no per-week tally. Week grouping is chronology; a
  number beside it is a score.
- **Nouns keep their article** (`die Gepflogenheit`), since a stripped headword teaches
  the wrong form on every scan.

**The captured-words line stays, as a diagnostic.** It is the one element on this screen
that isn't history, kept deliberately: it's the only visible health signal for the
nightly job (architecture.md §5b). If the number climbs day over day, the job isn't
running — which on a laptop that sleeps is a live failure mode, not a hypothetical.

For that to work it must **count `pending` captures only** — those not yet processed by
the job. Words already at `queued` have their dossiers built and are waiting on *you* to
do a session, so counting them would make the number grow during any normal busy week
and produce a false alarm. Counting the wrong status turns the diagnostic into noise.

Revisit once the job has proven stable; at that point this line has no remaining purpose
on a history screen.

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

No level set yet. May be screen 9 with different framing rather than a distinct view.

---

## States

Cross-cutting states that need designing, not just screens. These are the ones
otherwise discovered one at a time during implementation.

| State | Screen | Notes |
|---|---|---|
| Dossier generating | 2 | Cache miss with adaptive thinking is a real wait. Largely avoidable — see Pre-generation below. |
| Dossier generation failed | 2 | API error, network, or refusal. Must not lose the session: offer retry or skip to another word. |
| Anchor feedback pending | 4 | Short, not instant. |
| Anchor feedback failed | 4 | The word still lands in the log. Feedback is optional; the session record is not. |
| Know it → next word | 1 | A transition, not a screen. Rapid rejection with no acknowledgement reads as broken — needs a micro-confirmation. |
| Level exhausted | 1 | No unknown words remain at the active level. Guaranteed with the 20-word fixture, so build it in Phase 2 rather than hitting a crash. |
| Session resumed | any | App closed mid-dossier, reopened later. Resume in place or discard — needs a decision. |
| Empty log | 6 | Before the first completed session. |
| No search results | 8 | |
| Error report submitted | 2, 7 | Confirmation for the §11 affordance. |
| Server unreachable | all | The laptop-asleep case — see below. |

---

## Two decisions that shape the screens

### Pre-generation removes the loading state

The selection engine picks the next word deterministically, so its dossier can be
generated and cached in the background as soon as a session ends. The next session then
opens instantly, and the spinner becomes a rare fallback rather than a normal part of
the flow.

This materially changes how screen 2 feels and is cheaper to build now than to retrofit.

### Server unreachable needs a decision

When the laptop is asleep there is no server to render a friendly message — the phone
gets the browser's error page, which reads as *"this app is broken"* rather than
*"your laptop is closed."* Given that the laptop-asleep case is the main threat to the
§9 primary metric, that misattribution is expensive.

A minimal service worker serving a static shell would fix it. Arguably this is not the
"offline mode" that §6 rules out — it caches no content and enables no sessions — but
it is adjacent enough to flag rather than assume. **Open, pending a call.**
