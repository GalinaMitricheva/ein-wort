// Base HTML layout and the app's whole stylesheet, inlined (no build step, and
// one request per page suits a single-user app over a tailnet). The CSS encodes
// the design language settled in review (ui.md): mobile-first ~420px column,
// serif for German content, mono for reference data, sans for chrome, hairline
// dividers not cards, and a single accent colour used sparingly.

export interface LayoutOptions {
  title?: string;
  body: string;
}

const STYLE = `
:root {
  --bg: #fbfaf7;
  --surface: #ffffff;
  --text: #1c1b19;
  --text-secondary: #55524b;
  --text-muted: #928e83;
  --border: #e8e4db;
  --border-strong: #d8d3c8;
  --accent: #1f7a63;
  --accent-bg: #e4f1ec;
  --accent-text: #12513e;
  --radius: 8px;
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-serif: Georgia, "Iowan Old Style", "Times New Roman", serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
}
.column {
  max-width: 420px;
  margin: 0 auto;
  padding: 20px 16px 40px;
  min-height: 100vh;
}
.card {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  min-height: 78vh;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}
.brand { font-size: 13px; color: var(--text-muted); }
.level-badge {
  font-size: 12px; color: var(--text-secondary);
  background: var(--bg); padding: 3px 10px; border-radius: var(--radius);
  text-decoration: none;
}
.gear { color: var(--text-muted); text-decoration: none; font-size: 18px; line-height: 1; }
.grow { flex: 1 1 auto; }

.word { font-family: var(--font-serif); font-weight: 400; color: var(--text); line-height: 1.2; }
.word-lg { font-size: 32px; }
.word-md { font-size: 26px; }
.pos { font-size: 14px; color: var(--text-secondary); margin-top: 8px; }
.forms-inline { font-family: var(--font-mono); font-size: 14px; color: var(--text-muted); margin-top: 4px; }

.prompt { font-size: 14px; color: var(--text-secondary); margin-bottom: 14px; }
.actions { display: flex; flex-direction: column; gap: 8px; margin-top: 24px; }

button, .btn {
  font-family: var(--font-sans); font-size: 15px;
  width: 100%; height: 46px;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface); color: var(--text);
  border: 0.5px solid var(--border-strong); border-radius: var(--radius);
  cursor: pointer; text-decoration: none;
  transition: background 0.12s;
}
button:hover, .btn:hover { background: var(--bg); }
button:active, .btn:active { transform: scale(0.99); }
.btn-primary { background: var(--text); color: var(--surface); border-color: var(--text); }
.btn-primary:hover { background: #000; }
.linkish { background: none; border: none; color: var(--text-secondary); font-size: 14px; height: auto; }
.center { text-align: center; }
.quiet { font-size: 12px; color: var(--text-muted); }
form.inline { margin: 0; display: contents; }

/* dossier */
.section-label { font-size: 12px; color: var(--text-muted); margin: 0 0 12px; }
.divider { border-top: 0.5px solid var(--border); margin: 24px 0 20px; }
.meaning-de { font-size: 16px; color: var(--text); margin-bottom: 8px; }
.meaning-en { font-size: 15px; color: var(--text-secondary); }
.reg-badge {
  font-size: 12px; color: var(--text-secondary);
  background: var(--bg); padding: 3px 10px; border-radius: var(--radius);
}
.form-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 5px; }
.form-label { font-size: 12px; color: var(--text-muted); min-width: 92px; }
.form-value { font-family: var(--font-mono); font-size: 13px; color: var(--text); }
.rektion-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 9px; flex-wrap: wrap; }
.rektion-pattern { font-family: var(--font-serif); font-size: 15px; color: var(--text); }
.case-tag {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--accent-text); background: var(--accent-bg);
  padding: 2px 7px; border-radius: var(--radius);
}
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 13px; color: var(--text); background: var(--bg); padding: 5px 10px; border-radius: var(--radius); }
.w { cursor: pointer; -webkit-tap-highlight-color: transparent; }
.w.marked { border-bottom: 2px solid var(--accent); }
.tray { background: var(--bg); border-radius: var(--radius); padding: 12px 14px; margin-top: 24px; }
.tray:empty { display: none; }
.tray-label { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
.tray-chip { font-size: 13px; color: var(--accent-text); background: var(--accent-bg); padding: 4px 9px; border-radius: var(--radius); }
.example-de { font-family: var(--font-serif); font-size: 15px; color: var(--text); line-height: 1.65; margin-bottom: 6px; }
.example-en { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 18px; }
.example-en:last-child { margin-bottom: 0; }
.register-note { font-size: 14px; color: var(--text-secondary); line-height: 1.65; }
.syn-row { display: flex; gap: 10px; margin-bottom: 12px; }
.syn-lemma { font-family: var(--font-serif); font-size: 14px; color: var(--text); min-width: 92px; }
.syn-note { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

/* "Kenne ich" micro-confirmation (2.10) */
button.ack { background: var(--accent-bg); color: var(--accent-text); border-color: var(--accent);
  transition: background 0.2s, color 0.2s, border-color 0.2s; }

/* report an error (3.7 / ui.md screen 2) — deliberately quiet, below Weiter */
.report { margin-top: 16px; }
.report summary { list-style: none; text-align: center; font-size: 12px; color: var(--text-muted); cursor: pointer; }
.report summary::-webkit-details-marker { display: none; }
.report[open] summary { margin-bottom: 10px; }
.report textarea { width: 100%; font-family: var(--font-sans); font-size: 14px; color: var(--text);
  line-height: 1.5; padding: 8px 10px; resize: vertical; background: var(--surface);
  border: 0.5px solid var(--border-strong); border-radius: var(--radius); }
.report .actions { margin-top: 8px; }
.report-send { height: 40px; font-size: 14px; }
.report-done { margin-top: 16px; text-align: center; font-size: 12px; color: var(--text-muted); }

/* level picker */
.title { font-family: var(--font-serif); font-size: 22px; color: var(--text); margin: 0 0 20px; line-height: 1.25; }
.tagline { font-size: 15px; color: var(--text-secondary); line-height: 1.65; margin-bottom: 36px; }
.level-opt {
  display: block; width: 100%; text-align: left;
  padding: 14px; border: 0.5px solid var(--border); border-radius: var(--radius);
  margin-bottom: 8px; background: var(--surface); cursor: pointer; height: auto;
}
.level-opt.selected,
.level-opt:has(input:checked) { border-color: var(--border-strong); background: var(--bg); }
.level-name { font-size: 16px; color: var(--text); margin-bottom: 3px; }
.level-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

/* log */
.search { width: 100%; height: 40px; padding: 0 12px; margin-bottom: 20px;
  border: 0.5px solid var(--border-strong); border-radius: var(--radius);
  font-family: var(--font-sans); font-size: 15px; background: var(--surface); color: var(--text); }
.capture-line { display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  background: var(--bg); border-radius: var(--radius); margin-bottom: 24px;
  font-size: 13px; color: var(--text-secondary); }
.log-row { padding-bottom: 16px; border-bottom: 0.5px solid var(--border); margin-bottom: 16px; }
.log-row:last-child { border-bottom: none; }
.log-lemma { font-family: var(--font-serif); font-size: 17px; color: var(--text); }
.log-meaning { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-top: 3px; }
`;

export function layout({ title = "Ein Wort", body }: LayoutOptions): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <style>${STYLE}</style>
  <script src="/vendor/htmx.min.js" defer></script>
</head>
<body>
  <main class="column">
${body}
  </main>
</body>
</html>`;
}

/** HTML-escape for interpolated text. Not a sanitiser for rich input. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
