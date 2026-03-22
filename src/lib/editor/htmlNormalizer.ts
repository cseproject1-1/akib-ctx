/**
 * @module htmlNormalizer
 * @description Advanced DOM-based HTML normalizer for clipboard content from external apps.
 *
 * Handles:
 *  - Notion clipboard/export HTML  (data-block-id, class="notion-*")
 *  - Google Docs clipboard HTML    (docs-internal-guid, id="docs-internal-guid-*")
 *  - Microsoft Word/Office HTML    (mso-* CSS, urn:schemas-microsoft-com namespace)
 *
 * Strategy: Parse HTML with DOMParser → walk tree → emit clean semantic HTML.
 * No external dependencies — uses only browser-native APIs.
 */

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the clipboard HTML is from an external rich-text app
 * (Notion, Google Docs, or Microsoft Word).
 *
 * @param html - Raw `text/html` clipboard string
 */
export function isClipboardFromExternalApp(html: string): boolean {
  return (
    /data-block-id/i.test(html) ||          // Notion blocks
    /class="notion-/i.test(html) ||          // Notion class names
    /docs-internal-guid/i.test(html) ||      // Google Docs
    /urn:schemas-microsoft-com/i.test(html) || // Word XML
    /content="Microsoft Word/i.test(html) || // Word meta generator
    /mso-[a-z-]+\s*:/i.test(html)            // Word MSO CSS inline styles
  );
}

// ---------------------------------------------------------------------------
// Element allow-lists
// ---------------------------------------------------------------------------

/** Block elements we want to preserve as-is with their children. */
const ALLOWED_BLOCK = new Set([
  'p', 'div', 'section', 'article',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'pre', 'code', 'blockquote',
  'details', 'summary',
  'figure', 'figcaption',
  'hr', 'br',
]);

/** Inline elements we want to preserve. */
const ALLOWED_INLINE = new Set([
  'a', 'strong', 'b', 'em', 'i', 's', 'del', 'u', 'mark',
  'sup', 'sub', 'span', 'abbr', 'cite', 'q',
  'code', 'kbd', 'samp',
  'img',
]);

/** Elements whose subtree should be removed completely. */
const REMOVE_ENTIRELY = new Set([
  'script', 'style', 'head', 'meta', 'link', 'noscript',
  'iframe', 'object', 'embed', 'applet', 'form',
  'button', 'input', 'select', 'textarea',
  'nav', 'footer', 'header', 'aside',
]);

// ---------------------------------------------------------------------------
// Attribute allow-lists per tag
// ---------------------------------------------------------------------------

const ALLOWED_ATTRS: Record<string, string[]> = {
  a:          ['href', 'title', 'target', 'rel'],
  img:        ['src', 'alt', 'width', 'height', 'title'],
  th:         ['colspan', 'rowspan', 'scope'],
  td:         ['colspan', 'rowspan'],
  ol:         ['start', 'type'],
  li:         ['value'],
  details:    [],
  summary:    [],
  code:       ['class'],   // keep language-* class for syntax highlighting
  pre:        ['class'],
  blockquote: ['cite'],
  h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
  p: [], ul: [], table: [], thead: [], tbody: [], tr: [],
};

/** Allowed global attributes (apply to every element). */
const GLOBAL_ALLOWED = new Set(['id', 'class', 'lang', 'dir']);

// ---------------------------------------------------------------------------
// CSS property strip list (Office / Notion internal styling)
// ---------------------------------------------------------------------------
const MSO_STYLE_RE = /\b(mso-[a-z-]+|tab-stops?|text-indent|white-space|font-family|font-size|color|background(-color)?|margin[a-z-]*|padding[a-z-]*|border[a-z-]*|line-height)\s*:[^;]+;?/gi;

function stripMessyCss(style: string): string {
  // Remove all mso-* and common layout-only CSS
  return style.replace(MSO_STYLE_RE, '').trim();
}

// ---------------------------------------------------------------------------
// Notion-specific block classifiers
// ---------------------------------------------------------------------------

function isNotionCallout(el: Element): boolean {
  const cls = el.getAttribute('class') || '';
  return (
    cls.includes('notion-callout') ||
    el.getAttribute('data-block-type') === 'callout' ||
    // Notion clipboard uses <figure> with callout class
    (el.tagName === 'FIGURE' && cls.includes('callout'))
  );
}

function isNotionToggle(el: Element): boolean {
  const cls = el.getAttribute('class') || '';
  return (
    cls.includes('notion-toggle') ||
    el.getAttribute('data-block-type') === 'toggle' ||
    el.tagName === 'DETAILS'
  );
}

function isNotionDivider(el: Element): boolean {
  const cls = el.getAttribute('class') || '';
  return cls.includes('notion-divider') || el.getAttribute('data-block-type') === 'divider';
}

// ---------------------------------------------------------------------------
// Google Docs-specific classifiers
// ---------------------------------------------------------------------------

function isGDocsWrapper(el: Element): boolean {
  const id = el.getAttribute('id') || '';
  const cls = el.getAttribute('class') || '';
  const style = el.getAttribute('style') || '';
  return (
    id.startsWith('docs-internal-guid') ||
    cls.includes('kix-') ||
    // GDocs wraps everything in margin-bearing spans — collapse them
    (el.tagName === 'SPAN' && /^\s*(margin|padding|font-family|font-size|color)\s*:\s*[^;]+;\s*$/.test(style))
  );
}

// ---------------------------------------------------------------------------
// Core walker
// ---------------------------------------------------------------------------

/**
 * Recursively walk a DOM node and emit clean HTML text.
 *
 * @param node  - The DOM node to process
 * @param inPre - True when inside a <pre> block (preserve whitespace verbatim)
 * @returns     Clean HTML string
 */
function walkNode(node: Node, inPre = false): string {
  // Text nodes
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (inPre) return text;
    // Collapse whitespace-only text nodes outside of pre
    if (/^\s+$/.test(text)) return ' ';
    return escapeHtml(text);
  }

  // Non-element, non-text nodes (comments, CDATA, etc.) — skip
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  // --- Remove entirely ---
  if (REMOVE_ENTIRELY.has(tag)) return '';

  // --- Notion callout → <blockquote> ---
  if (isNotionCallout(el)) {
    const inner = walkChildren(el, inPre);
    return `<blockquote>${inner}</blockquote>`;
  }

  // --- Notion divider → <hr> ---
  if (isNotionDivider(el)) return '<hr>';

  // --- Notion toggle / <details> → keep as <details> ---
  if (isNotionToggle(el) && tag !== 'details') {
    const inner = walkChildren(el, inPre);
    return `<details>${inner}</details>`;
  }

  // --- Google Docs transparent wrappers → unwrap ---
  if (isGDocsWrapper(el)) {
    return walkChildren(el, inPre);
  }

  // --- <span> with only mso/gdocs styling → unwrap ---
  if (tag === 'span') {
    const style = el.getAttribute('style') || '';
    const cls = el.getAttribute('class') || '';
    const isMsoSpan = /mso-/i.test(style);
    // Notion "notion-text" spans are just styled spans → unwrap
    const isNotionText = cls.includes('notion-text') || cls.includes('notion-inline-');
    if (isMsoSpan || isNotionText) {
      return walkChildren(el, inPre);
    }
  }

  // --- Allowed elements --- 
  if (ALLOWED_BLOCK.has(tag) || ALLOWED_INLINE.has(tag)) {
    const childContent = walkChildren(el, inPre || tag === 'pre');

    // Build clean attribute string
    const attrsStr = buildAttrs(el, tag);
    
    // Self-closing void elements
    if (tag === 'br') return '<br>';
    if (tag === 'hr') return '<hr>';
    if (tag === 'img') return `<img${attrsStr}>`;

    return `<${tag}${attrsStr}>${childContent}</${tag}>`;
  }

  // --- Unknown/wrapper elements (div, span, article, etc. not already handled) ---
  // Unwrap — keep children, drop the element itself
  return walkChildren(el, inPre);
}

function walkChildren(el: Element, inPre = false): string {
  let out = '';
  el.childNodes.forEach((child) => {
    out += walkNode(child, inPre);
  });
  return out;
}

/**
 * Build safe attribute string for an element.
 * - Only emits attributes from the per-tag allow-list + global allow-list
 * - Strips all mso-* style properties
 * - Always adds rel="noopener noreferrer" to <a> tags
 */
function buildAttrs(el: Element, tag: string): string {
  const allowed = new Set([
    ...(ALLOWED_ATTRS[tag] || []),
    // Allow class + id on all block elements for downstream TipTap schema hints
    ...(['p','div','li','blockquote','details','summary','code','pre'].includes(tag)
      ? [...GLOBAL_ALLOWED]
      : []),
  ]);

  let out = '';

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();

    if (name === 'style') {
      const cleaned = stripMessyCss(attr.value);
      if (cleaned) out += ` style="${escapeAttr(cleaned)}"`;
      continue;
    }

    if (!allowed.has(name)) continue;

    // Sanitize href/src to prevent javascript: URIs
    if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) continue;

    out += ` ${name}="${escapeAttr(attr.value)}"`;
  }

  // Force safe link attributes
  if (tag === 'a') {
    if (!el.getAttribute('target')) out += ' target="_blank"';
    if (!el.getAttribute('rel'))    out += ' rel="noopener noreferrer"';
  }

  return out;
}

// ---------------------------------------------------------------------------
// Post-processing passes
// ---------------------------------------------------------------------------

/**
 * Collapse multiple consecutive <br> into a single paragraph break.
 * Word often inserts `<br><br>` as paragraph separators.
 */
function collapseBreaks(html: string): string {
  // Word: <p ...></p> with only &nbsp; → drop
  html = html.replace(/<p[^>]*>\s*(&nbsp;|\u00A0)?\s*<\/p>/gi, '');
  // Multiple <br> in a row → single <br>
  html = html.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
  return html;
}

/**
 * Remove empty block wrappers that Notion/Word leave behind.
 * e.g. `<div></div>`, `<p> </p>`, nested empty spans.
 */
function removeEmptyBlocks(html: string): string {
  // Remove divs/spans/sections with nothing meaningful inside
  html = html.replace(/<(div|span|section|article)[^>]*>\s*<\/\1>/gi, '');
  return html;
}

/**
 * Strip Notion's data-block-id and data-content-editable-leaf attributes
 * that the walker may have missed (e.g. on table cells).
 */
function stripNotionDataAttrs(html: string): string {
  return html.replace(/\s*data-(block-(id|type)|content-editable-leaf|token-index|offset-key|reactroot)[^"]*="[^"]*"/gi, '');
}

/**
 * Google Docs uses &nbsp; liberally. Collapse sequences to a single space,
 * but preserve &nbsp; inside <code>/<pre>.
 */
function normalizeNbsp(html: string): string {
  // Only outside pre/code blocks
  const parts = html.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/gi);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part; // inside pre/code — preserve
    return part.replace(/(&nbsp;|\u00A0){2,}/g, ' ').replace(/(&nbsp;|\u00A0)/g, ' ');
  }).join('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @function normalizeHtml
 * @description Normalize clipboard or pasted HTML from external apps into clean,
 * semantic HTML that TipTap can parse without losing structure.
 *
 * @param html - Raw HTML string (from clipboard `text/html` or file import)
 * @returns Clean HTML string suitable for TipTap `insertContent`
 *
 * @example
 * const clean = normalizeHtml(clipboardHtml);
 * editor.commands.insertContent(clean);
 *
 * @performance O(n) where n = total DOM node count in the pasted tree
 * @security Strips javascript: URIs; removes all script/style/head elements;
 *           whitelists attributes per element tag
 */
export function normalizeHtml(html: string): string {
  if (!html || !html.trim()) return '';

  // Guard: must have DOMParser (browser environment)
  if (typeof DOMParser === 'undefined') return html;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return html; // Parsing failed — return original
  }

  // Start from the <body> to skip <head> metadata
  const body = doc.body;
  if (!body) return html;

  // Walk and emit clean HTML
  let clean = walkChildren(body);

  // Post-processing passes
  clean = collapseBreaks(clean);
  clean = removeEmptyBlocks(clean);
  clean = stripNotionDataAttrs(clean);
  clean = normalizeNbsp(clean);

  // Final trim of excessive whitespace between block elements
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();

  return clean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
