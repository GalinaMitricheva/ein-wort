import { escapeHtml as e } from "./layout.ts";
import { displayLemma, type WordRow, type Level } from "../core/store.ts";
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

// Split German text into tap targets (ui.md screen 2): each word becomes a
// <span class="w" data-s="…">, punctuation stays plain. Marked words (already
// captured in this session) get the accent underline via .marked.
function tappable(text: string, marked: Set<string>): string {
  return text
    .split(/(\s+)/)
    .map((tok) => {
      if (/^\s*$/.test(tok)) return tok;
      const m = /^([^\p{L}]*)([\p{L}][\p{L}ß\-]*)?([^\p{L}]*)$/u.exec(tok);
      if (!m || !m[2]) return e(tok);
      const word = m[2];
      const cls = marked.has(word) ? "w marked" : "w";
      return `${e(m[1] ?? "")}<span class="${cls}" data-s="${e(word)}">${e(word)}</span>${e(m[3] ?? "")}`;
    })
    .join("");
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
          <button id="ack-know" name="answer" value="know-it" type="submit">Kenne ich</button>
          <button name="answer" value="vaguely" type="submit">Vage</button>
          <button name="answer" value="new" type="submit">Neu für mich</button>
        </div>
      </form>
    </div>
  </div>
  ${ackScript}`;
}

// 2.10 — a brief acknowledgement when "Kenne ich" is tapped before the redirect
// carries you to the next word, so a known word doesn't just blink past. Pure
// progressive enhancement: with no JS the button submits normally.
const ackScript = `<script>
(function(){
  var b=document.getElementById('ack-know');
  if(!b||!b.form||!b.form.requestSubmit) return;
  b.addEventListener('click',function(ev){
    if(b.dataset.acking) return;
    ev.preventDefault();
    b.dataset.acking='1';
    b.classList.add('ack');
    b.textContent='Schon bekannt \\u2713';
    setTimeout(function(){ b.form.requestSubmit(b); }, 480);
  });
})();
</script>`;

function dossierSections(d: Dossier, marked: Set<string>): string {
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

  // Collocations and examples are the tap targets for word capture (ui.md screen 2).
  if (d.collocations.length) {
    parts.push(`<div class="divider"></div><div class="section-label">Wortverbindungen</div>
      <div class="chips">` +
      d.collocations.map((c) => `<span class="chip">${tappable(c.phrase, marked)}</span>`).join("") +
      `</div>`);
  }

  parts.push(`<div class="divider"></div><div class="section-label">Im Gebrauch</div>` +
    d.examples
      .map((x) => `<div class="example-de">${tappable(x.de, marked)}</div><div class="example-en">${e(x.en)}</div>`)
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

/** Inner HTML of the "Gemerkt für später" tray. Empty string hides it (CSS :empty). */
export function trayInner(entries: string[]): string {
  if (!entries.length) return "";
  return `<div class="tray-label">Gemerkt für später</div>
    <div class="chips">${entries.map((x) => `<span class="tray-chip">${e(x)}</span>`).join("")}</div>`;
}

const captureScript = (sessionId: number) => `<script>
(function(){
  var sid=${sessionId};
  document.addEventListener('click',function(ev){
    var el=ev.target.closest('.w'); if(!el) return;
    var s=el.getAttribute('data-s');
    fetch('/capture',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({surface:s,session:sid})})
      .then(function(r){return r.json()})
      .then(function(d){
        document.querySelectorAll('.w').forEach(function(w){ if(w.getAttribute('data-s')===s) w.classList.toggle('marked',d.marked); });
        var t=document.getElementById('tray'); if(t) t.innerHTML=d.tray;
      });
  });
})();
</script>`;

/** "Fehler melden" (§11 / ui.md screen 2): a quiet 12px affordance under Weiter.
 *  Progressive disclosure via <details> — no JS. Once reported, shows a settled
 *  acknowledgement instead of the form. */
function reportAffordance(sessionId: number, reported: boolean): string {
  if (reported) return `<div class="report-done">Fehler gemeldet ✓</div>`;
  return `<details class="report">
    <summary>Fehler melden</summary>
    <form method="post" action="/session/${sessionId}/report">
      <textarea name="note" rows="2" maxlength="1000" placeholder="Was stimmt hier nicht?"></textarea>
      <div class="actions"><button class="report-send" type="submit">Absenden</button></div>
    </form>
  </details>`;
}

export function dossierScreen(
  word: WordRow,
  dossier: Dossier,
  sessionId: number,
  marked: Set<string>,
  trayEntries: string[],
  reported: boolean,
): string {
  return `<div class="card">
    <div class="top">
      <div class="word word-md">${e(displayLemma(word))}</div>
      <span class="reg-badge">${e(REGISTER_LABEL[dossier.register] ?? dossier.register)}</span>
    </div>
    <div class="grow">
      ${dossierSections(dossier, marked)}
      <div id="tray" class="tray">${trayInner(trayEntries)}</div>
    </div>
    <form class="inline" method="post" action="/session/${sessionId}/complete">
      <div class="actions">
        <button class="btn-primary" type="submit">Weiter</button>
      </div>
    </form>
    ${reportAffordance(sessionId, reported)}
  </div>
  ${captureScript(sessionId)}`;
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
  // A first-class, expected end state (not an edge case): the learner has met or
  // dismissed every word in the pool at this level. The pool grows over time.
  return `<div class="card">
    <div class="top"><span class="brand">Ein Wort</span><a class="level-badge" href="/settings">${e(level)}</a></div>
    <div class="grow" style="justify-content:center; display:flex; flex-direction:column">
      <div class="title" style="margin-bottom:10px">Du hast alle Wörter kennengelernt.</div>
      <div class="register-note">Auf Niveau ${e(level)} gibt es im Moment nichts Neues. Wechsle das Niveau — oder die Liste wächst mit der Zeit.</div>
    </div>
    <div class="center"><a class="linkish" href="/settings">Niveau wechseln</a></div>
  </div>`;
}

function levelOptions(current: Level, selectable: boolean): string {
  return LEVELS.map(({ level, desc }) => {
    const sel = level === current ? " selected" : "";
    const inner = `<div class="level-name">${level}</div><div class="level-desc">${e(desc)}</div>`;
    // Button variant (settings): a tap submits immediately, so the current level
    // is marked server-side with .selected. Radio variant (first run): the visible
    // highlight follows the actually-checked radio via :has() in CSS, so tapping an
    // option reacts even though nothing is submitted until "Erstes Wort".
    return selectable
      ? `<button class="level-opt${sel}" name="level" value="${level}" type="submit">${inner}</button>`
      : `<label class="level-opt"><input type="radio" name="level" value="${level}"${level === current ? " checked" : ""} style="position:absolute;opacity:0">${inner}</label>`;
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
