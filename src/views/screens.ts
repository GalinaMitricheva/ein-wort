import { escapeHtml as e } from "./layout.ts";
import type { WordRow, Level, MetWord } from "../core/store.ts";
import type { Dossier } from "../core/dossier/schema.ts";

// Pure rendering. Each function returns the inner HTML for a screen; routes wrap
// it in layout(). Matches the approved designs in ui.md.

const POS_LABEL: Record<string, string> = {
  noun: "Substantiv",
  verb: "Verb",
  adj: "Adjektiv",
  adv: "Adverb",
};

const REGISTER_LABEL: Record<string, string> = {
  formal: "formell",
  neutral: "neutral",
  colloquial: "umgangssprachlich",
  regional: "regional",
};

const LEVELS: { level: Level; desc: string }[] = [
  { level: "B1", desc: "Alltag, vertraute Themen, klare Standardsprache" },
  { level: "B2", desc: "Beruf, Diskussionen, abstraktere Themen" },
  { level: "C1", desc: "Anspruchsvolle Texte, feine Nuancen, gehobene Sprache" },
];

/** The word with its gender, the way it's learned (nouns carry their article). */
function displayLemma(w: WordRow): string {
  return w.pos === "noun" && w.article ? `${w.article} ${w.lemma}` : w.lemma;
}

function keyFormsLine(w: WordRow): string | null {
  if (w.pos === "verb" && w.key_forms) {
    const f = JSON.parse(w.key_forms) as Record<string, string>;
    return [f.present, f.past, f.perfect].filter(Boolean).join(" · ");
  }
  if (w.pos === "noun" && w.plural) return `Plural: die ${w.plural}`;
  return null;
}

export function offerScreen(word: WordRow, sessionId: number, level: Level): string {
  const forms = keyFormsLine(word);
  return `<div class="card">
    <div class="top">
      <span class="brand">Ein Wort</span>
      <a class="level-badge" href="/settings">${e(level)}</a>
    </div>
    <div class="grow">
      <div class="word word-lg">${e(displayLemma(word))}</div>
      <div class="pos">${e(POS_LABEL[word.pos] ?? word.pos)}</div>
      ${forms ? `<div class="forms-inline">${e(forms)}</div>` : ""}
    </div>
    <div>
      <div class="prompt">Kennst du dieses Wort?</div>
      <form class="inline" method="post" action="/session/${sessionId}/calibrate">
        <div class="actions">
          <button name="answer" value="know-it" type="submit">Kenne ich</button>
          <button name="answer" value="vaguely" type="submit">Vage</button>
          <button name="answer" value="new" type="submit">Neu für mich</button>
        </div>
      </form>
    </div>
  </div>`;
}

function dossierSections(d: Dossier): string {
  const parts: string[] = [];

  parts.push(`<div class="meaning-de">${e(d.meaning_de)}</div>
    <div class="meaning-en">${e(d.meaning_en)}</div>`);

  if (d.forms.length) {
    parts.push(`<div class="divider"></div><div class="section-label">Formen</div>` +
      d.forms
        .map((f) => `<div class="form-row"><span class="form-label">${e(f.label)}</span><span class="form-value">${e(f.value)}</span></div>`)
        .join(""));
  }

  if (d.rektion.length) {
    parts.push(`<div class="divider"></div><div class="section-label">Rektion</div>` +
      d.rektion
        .map((r) => `<div class="rektion-row"><span class="rektion-pattern">${e(r.pattern)}</span><span class="case-tag">${e(r.cases)}</span></div>`)
        .join(""));
  }

  if (d.collocations.length) {
    parts.push(`<div class="divider"></div><div class="section-label">Wortverbindungen</div>
      <div class="chips">` +
      d.collocations.map((c) => `<span class="chip">${e(c.phrase)}</span>`).join("") +
      `</div>`);
  }

  parts.push(`<div class="divider"></div><div class="section-label">Im Gebrauch</div>` +
    d.examples
      .map((x) => `<div class="example-de">${e(x.de)}</div><div class="example-en">${e(x.en)}</div>`)
      .join(""));

  parts.push(`<div class="divider"></div><div class="section-label">Register</div>
    <div class="register-note">${e(d.register_note)}</div>`);

  if (d.near_synonyms.length) {
    parts.push(`<div class="divider"></div><div class="section-label">Nicht zu verwechseln mit</div>` +
      d.near_synonyms
        .map((s) => `<div class="syn-row"><span class="syn-lemma">${e(s.lemma)}</span><span class="syn-note">${e(s.distinction)}</span></div>`)
        .join(""));
  }

  return parts.join("\n");
}

export function dossierScreen(word: WordRow, dossier: Dossier, sessionId: number): string {
  return `<div class="card">
    <div class="top">
      <div class="word word-md">${e(displayLemma(word))}</div>
      <span class="reg-badge">${e(REGISTER_LABEL[dossier.register] ?? dossier.register)}</span>
    </div>
    <div class="grow">
      ${dossierSections(dossier)}
    </div>
    <form class="inline" method="post" action="/session/${sessionId}/complete">
      <div class="actions">
        <button class="btn-primary" type="submit">Weiter</button>
      </div>
    </form>
  </div>`;
}

export function sessionCompleteScreen(word: WordRow): string {
  return `<div class="card">
    <div class="top"><span class="brand">Ein Wort</span></div>
    <div class="grow">
      <div class="word word-md">${e(displayLemma(word))}</div>
      <div class="meaning-en" style="margin-top:10px">steht jetzt in deinen Wörtern.</div>
    </div>
    <div class="center">
      <a class="linkish" href="/log">Alle Wörter</a>
    </div>
  </div>`;
}

export function levelExhaustedScreen(level: Level): string {
  return `<div class="card">
    <div class="top"><span class="brand">Ein Wort</span><a class="level-badge" href="/settings">${e(level)}</a></div>
    <div class="grow" style="justify-content:center; display:flex; flex-direction:column">
      <div class="title" style="margin-bottom:10px">Für heute nichts Neues.</div>
      <div class="register-note">Auf Niveau ${e(level)} sind alle Wörter durch. Du kannst dein Niveau ändern.</div>
    </div>
    <div class="center"><a class="linkish" href="/settings">Niveau ändern</a></div>
  </div>`;
}

function levelOptions(current: Level, selectable: boolean): string {
  return LEVELS.map(({ level, desc }) => {
    const sel = level === current ? " selected" : "";
    const inner = `<div class="level-name">${level}</div><div class="level-desc">${e(desc)}</div>`;
    return selectable
      ? `<button class="level-opt${sel}" name="level" value="${level}" type="submit">${inner}</button>`
      : `<label class="level-opt${sel}"><input type="radio" name="level" value="${level}"${level === current ? " checked" : ""} style="position:absolute;opacity:0">${inner}</label>`;
  }).join("");
}

/** Screen 10 — pick a level then start. */
export function firstRunScreen(): string {
  return `<div class="card">
    <div class="grow">
      <div class="word word-lg" style="margin-bottom:12px">Ein Wort</div>
      <div class="tagline">Ein Wort pro Sitzung. Gelernt in seinem natürlichen Umfeld, nicht auf einer Karteikarte.</div>
      <div class="prompt" style="color:var(--text)">Wo stehst du gerade?</div>
      <form method="post" action="/level" id="lvl">
        ${levelOptions("B2", false)}
      </form>
    </div>
    <div>
      <div class="actions">
        <button class="btn-primary" type="submit" form="lvl">Erstes Wort</button>
      </div>
      <div class="center" style="margin-top:14px"><span class="quiet">Lässt sich jederzeit ändern.</span></div>
    </div>
  </div>`;
}

/** Screen 9 — change level; a tap saves. */
export function levelSelectorScreen(current: Level): string {
  return `<div class="card">
    <div class="top"><a class="gear" href="/" aria-label="Zurück">‹</a><span class="brand">Deine Wörter</span></div>
    <div class="title">Dein Niveau</div>
    <form method="post" action="/level">
      ${levelOptions(current, true)}
    </form>
    <div class="register-note" style="margin-top:20px; color:var(--text-muted)">Ändert nur, welche Wörter du künftig bekommst. Deine Wörter bleiben.</div>
  </div>`;
}

export interface LogEntry {
  word: WordRow;
  meaning_de: string;
}

/** Screen 6 (minimal this phase — no search yet). */
export function logScreen(entries: LogEntry[], pendingCaptures: number): string {
  const captureLine =
    pendingCaptures > 0
      ? `<div class="capture-line"><span>🔖</span><span>${pendingCaptures} ${pendingCaptures === 1 ? "gemerktes Wort wartet" : "gemerkte Wörter warten"}</span></div>`
      : "";
  const rows = entries.length
    ? entries
        .map(
          (x) =>
            `<div class="log-row"><div class="log-lemma">${e(displayLemma(x.word))}</div><div class="log-meaning">${e(x.meaning_de)}</div></div>`,
        )
        .join("")
    : `<div class="register-note" style="color:var(--text-muted)">Noch keine Wörter. Fang eine Sitzung an.</div>`;
  return `<div class="card" style="min-height:60vh">
    <div class="top"><a class="gear" href="/" aria-label="Zurück">‹</a><a class="gear" href="/settings" aria-label="Einstellungen">⚙</a></div>
    <input class="search" type="text" placeholder="Alle Wörter durchsuchen" disabled>
    ${captureLine}
    ${rows}
  </div>`;
}
