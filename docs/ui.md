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
| 1 | Offer + Calibrate | 🔵 In review |
| 2 | Dossier | ⬜ Not started |
| 3 | Anchor prompt | ⬜ Not started |
| 4 | Anchor feedback | ⬜ Not started |
| 5 | Session complete | ⬜ Not started |
| 6 | Words met (log) | ⬜ Not started |
| 7 | Log detail | ⬜ Not started |
| 8 | Search | ⬜ Not started |
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

### 2. Dossier

The dense one. This screen is why §6 chose a web app over a chat bot — it is a small
document, not a message.

Contains: meaning (DE + EN), 2–3 example sentences, top collocations, register note
(formal / neutral / colloquial / regional), near-synonym distinctions, and the
"report an error" affordance (§11 puts this in the MVP, not later).

When calibration was *Vaguely*, the near-synonym block is surfaced more prominently —
same cached artifact, different presentation. This is the resolution of open question
§10.3.

### 3. Anchor prompt

Free-text input, single attempt. Needs a **visible, unapologetic skip** — §4 marks the
step optional-but-encouraged, and if skipping feels furtive then the ≥70% completion
metric (§9) is measuring guilt rather than engagement.

### 4. Anchor feedback

Brief naturalness note. No score, no grading scale, no retry (§4).

### 5. Session complete

The word has landed in the log. Deliberately a dead end — **no "next word" button.**
§3.1 ends the session when the word is anchored and §7 rules out content-volume
maximization; the intended exit is closing the app.

---

## Log screens

### 6. Words met

Reverse-chronological list of learned words. A browsable record, not a queue (§4).

### 7. Log detail

A previously-met word's dossier, re-read. Same template as screen 2, different entry
point, no session chrome.

### 8. Search

Over lemma and meaning.

---

## System screens

### 9. Level selector

B1 / B2 / C1. Changeable anytime (§6).

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
