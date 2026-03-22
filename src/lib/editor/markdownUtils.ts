import { marked } from 'marked';

// ---------------------------------------------------------------------------
// GFM configuration
// ---------------------------------------------------------------------------

marked.use({
  gfm: true,
  breaks: false,
});

// ---------------------------------------------------------------------------
// Code renderer — preserves language class for TipTap's lowlight
// ---------------------------------------------------------------------------

const renderer = new marked.Renderer();

renderer.code = function (codeOrOptions: any, infostring?: string) {
  let lang = '';
  let code = '';
  if (typeof codeOrOptions === 'string') {
    code = codeOrOptions;
    lang = infostring || '';
  } else if (typeof codeOrOptions === 'object' && codeOrOptions !== null) {
    code = codeOrOptions.text || '';
    lang = codeOrOptions.lang || '';
  }
  const languageClass = lang ? `language-${lang}` : 'language-plaintext';
  const escapedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return `<pre><code class="${languageClass}">${escapedCode}</code></pre>`;
};

marked.use({ renderer });

// ---------------------------------------------------------------------------
// KaTeX HTML sanitizer — DOM-based (replaces 3-pass regex approach)
// ---------------------------------------------------------------------------

/**
 * @function sanitizeKatexHtml
 * @description Extracts LaTeX source from rendered KaTeX HTML by walking the DOM
 * and looking for `<annotation encoding="application/x-tex">` nodes.
 *
 * Converts:
 *   - `class="katex-display"` containers → `<div data-math-block data-latex="...">`
 *   - `class="katex"` inline spans      → `<code class="math-inline" data-math-inline="...">`
 *
 * Falls back to safe regex if DOMParser is unavailable (SSR / test environment).
 *
 * @param html - Raw HTML from clipboard containing rendered KaTeX
 * @returns HTML with KaTeX spans replaced by CtxNote math node markers
 *
 * @example
 * const clean = sanitizeKatexHtml(clipboardHtml);
 * editor.commands.insertContent(clean);
 */
export function sanitizeKatexHtml(html: string): string {
  if (!html.trim()) return html;

  // --- DOM path (browser) ---
  if (typeof DOMParser !== 'undefined') {
    return sanitizeKatexHtmlDom(html);
  }

  // --- Regex fallback (non-browser / test env) ---
  return sanitizeKatexHtmlRegex(html);
}

/**
 * DOM-based KaTeX sanitizer. Handles nested spans, multiple annotation formats,
 * and gracefully skips any element that does not contain a valid annotation.
 */
function sanitizeKatexHtmlDom(html: string): string {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return html;
  }

  const body = doc.body;

  // Process display math first (katex-display) — they may contain inline katex children
  const displayEls = Array.from(body.querySelectorAll('.katex-display'));
  for (const el of displayEls) {
    const latex = extractLatexFromKatexEl(el);
    if (latex !== null) {
      const escaped = escapeAttr(latex);
      const replacement = doc.createElement('div');
      replacement.setAttribute('data-math-block', '');
      replacement.setAttribute('data-latex', escaped);
      replacement.textContent = latex;
      el.replaceWith(replacement);
    }
  }

  // Process remaining inline katex spans
  const inlineEls = Array.from(body.querySelectorAll('.katex'));
  for (const el of inlineEls) {
    // Skip if already inside a processed math block
    if (el.closest('[data-math-block]')) continue;
    const latex = extractLatexFromKatexEl(el);
    if (latex !== null) {
      const escaped = escapeForAttr(latex);
      const replacement = doc.createElement('code');
      replacement.className = 'math-inline';
      replacement.setAttribute('data-math-inline', escaped);
      replacement.textContent = latex;
      el.replaceWith(replacement);
    }
  }

  return body.innerHTML;
}

/**
 * Extracts raw LaTeX string from a KaTeX-rendered element by finding the
 * `<annotation encoding="application/x-tex">` child.
 *
 * @returns LaTeX string or null if annotation not found
 */
function extractLatexFromKatexEl(el: Element): string | null {
  const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
  if (!annotation) return null;
  const raw = annotation.textContent || '';
  return decodeHtmlEntities(raw).trim();
}

/**
 * Regex-based fallback for environments without DOMParser.
 * Consolidated into two passes (display → inline) for clarity.
 */
function sanitizeKatexHtmlRegex(html: string): string {
  // Pass 1: display math
  html = html.replace(
    /<span[^>]*class="katex-display"[^>]*>[\s\S]*?<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>[\s\S]*?<\/span>/g,
    (_match, latex: string) => {
      const decoded = decodeHtmlEntities(latex.trim());
      const escaped = escapeAttr(decoded);
      return `<div data-math-block data-latex="${escaped}">${escaped}</div>`;
    }
  );

  // Pass 2: inline math (all remaining katex spans)
  html = html.replace(
    /<span[^>]*class="katex[^"]*"[^>]*>[\s\S]*?<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>[\s\S]*?<\/span>/g,
    (_match, latex: string) => {
      const decoded = decodeHtmlEntities(latex.trim());
      const escaped = escapeForAttr(decoded);
      return `<code class="math-inline" data-math-inline="${escaped}">${decoded}</code>`;
    }
  );

  return html;
}

// ---------------------------------------------------------------------------
// Math pre-processor — protect $ price values
// ---------------------------------------------------------------------------

/**
 * @function preprocessMath
 * @description Pre-processes LaTeX math delimiters before passing to `marked`.
 *
 * Dollar-sign safety: Only treats `$...$` as math when the content after `$`
 * starts with a LaTeX command character (letter, `\`, or `(`).
 * This prevents `$50 off` or `$100` being mangled as math.
 *
 * @example
 * preprocessMath('$$E=mc^2$$')  // → '<div data-math-block ...>'
 * preprocessMath('$E=mc^2$')    // → '<code class="math-inline" ...>'
 * preprocessMath('$50 off')     // → '$50 off'  (safe — no change)
 *
 * @param md - Raw markdown string
 * @returns Markdown with math blocks replaced by HTML placeholders
 */
export function preprocessMath(md: string): string {
  // --- Display math: $$...$$  (greedy on newlines) ---
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    const trimmed = latex.trim();
    const escaped = escapeAttr(trimmed);
    return `<div data-math-block data-latex="${escaped}">${escaped}</div>`;
  });

  // --- Inline math: $...$  ---
  // Guard: after the opening `$`, the content must start with a letter, \, (, or ^
  // This prevents matching "$50", "$100.00", "10$ fee", etc.
  md = md.replace(
    /(?<!\$)\$(?!\$)(?=[A-Za-z\\(^{])([^\n$]+?)\$(?!\$)/g,
    (_match, latex: string) => {
      const trimmed = latex.trim();
      const escaped = escapeForAttr(trimmed);
      return `<code class="math-inline" data-math-inline="${escaped}">${escapeHtmlEntities(trimmed)}</code>`;
    }
  );

  return md;
}

// ---------------------------------------------------------------------------
// Main markdown → HTML converter
// ---------------------------------------------------------------------------

/**
 * @function markdownToHtml
 * @description Converts Markdown (including GFM, tables, task lists, and math)
 * to HTML suitable for TipTap's `insertContent` or `setContent`.
 *
 * Pipeline:
 *  1. preprocessMath   — convert $$...$$ and $...$ to HTML placeholders
 *  2. marked.parse     — full GFM conversion (tables, strikethrough, task lists)
 *  3. Task list repair — marked emits `<input type="checkbox">` inside `<li>`;
 *                        converted to TipTap's `data-type="taskItem"` format
 *
 * @param md - Raw markdown string
 * @returns HTML string
 *
 * @example
 * const html = markdownToHtml('# Hello\n\n- [ ] Task');
 * editor.commands.setContent(html);
 */
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '';

  const processed = preprocessMath(md);

  let html: string;
  try {
    // marked v5+ sync path
    if (typeof (marked as any).parseSync === 'function') {
      html = (marked as any).parseSync(processed) as string;
    } else {
      html = marked.parse(processed, { async: false }) as string;
    }
  } catch {
    // Last resort — return safe escaped text wrapped in a paragraph
    return `<p>${escapeHtmlEntities(md)}</p>`;
  }

  // --- Task list post-processing ---
  // marked GFM outputs:
  //   <ul><li><input type="checkbox" disabled=""> text</li></ul>
  //   <ul><li><input type="checkbox" checked="" disabled=""> text</li></ul>
  //
  // TipTap expects:
  //   <ul data-type="taskList"><li data-type="taskItem" data-checked="true/false">
  //     <label><input type="checkbox" [checked] /></label>text
  //   </li></ul>

  // Step A: mark the parent <ul> of a task list
  html = html.replace(/<ul>\s*<li>\s*<input\s/g, '<ul data-type="taskList"><li><input ');

  // Step B: convert checked task items
  html = html.replace(
    /<li>\s*<input\s+(?:disabled=""\s+)?checked(?:="")?(?:\s+disabled(?:="")?)?(?:\s+type="checkbox")?[^>]*>\s*/gi,
    '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked />'
  );

  // Step C: convert unchecked task items
  html = html.replace(
    /<li>\s*<input\s+(?:disabled=""\s+)?type="checkbox"[^>]*>\s*/gi,
    '<li data-type="taskItem" data-checked="false"><label><input type="checkbox" />'
  );

  // Step D: close the label before </li>
  html = html.replace(
    /(<li data-type="taskItem"[^>]*><label><input[^/]*\/>)([^<]*)(<\/li>)/g,
    '$1$2</label></li>'
  );

  return html;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode common HTML entities back to their characters. */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Escape for use in HTML attribute values (double-quoted). */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape for use in attributes that will also be read as LaTeX (no quote escaping). */
function escapeForAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escape HTML special chars for text content. */
function escapeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
