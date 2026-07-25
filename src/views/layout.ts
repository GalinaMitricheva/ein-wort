// Base HTML layout. Server-rendered, htmx for interactivity, no client build
// step (architecture.md 1). Styling arrives in phase 2; this is structure only.
//
// The design language (ui.md) lives in real CSS once phase 2 begins. For now
// the layout only establishes the mobile viewport, the ~340px column, and the
// three typefaces the whole app depends on: serif for German content, mono for
// reference data, sans for chrome.

export interface LayoutOptions {
  title?: string;
  body: string;
}

export function layout({ title = "Ein Wort", body }: LayoutOptions): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <script src="/vendor/htmx.min.js" defer></script>
</head>
<body>
  <main class="column">
${body}
  </main>
</body>
</html>`;
}

/** Minimal HTML-escape for interpolated text. Not a sanitiser for rich input. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
