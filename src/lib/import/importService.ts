import { type Node } from '@xyflow/react';
import { marked } from 'marked';
import { normalizeHtml } from '@/lib/editor/htmlNormalizer';

interface ImportedNode {
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  style?: { width: number; height: number };
}

/**
 * @function parseMarkdownToNodes
 * @description Parses markdown content and converts it into canvas nodes.
 * Headings (H1, H2) become individual notes; sections between headers
 * become content within those nodes.
 *
 * @param content - Raw markdown string
 * @returns Array of canvas node definitions
 */
export function parseMarkdownToNodes(content: string): ImportedNode[] {
  const tokens = marked.lexer(content);
  const nodes: ImportedNode[] = [];
  
  let currentTitle = 'Imported Note';
  let currentContent = '';
  let x = 0;
  let y = 0;

  const createNode = (title: string, rawContent: string) => {
    if (!rawContent.trim() && title === 'Imported Note') return;
    
    nodes.push({
      type: 'aiNote',
      position: { x, y },
      data: {
        title: title || 'Untitled Section',
        content: rawContent.trim(),
        // Store as markdown so NoteEditor renders it as formatted text
        pasteContent: rawContent.trim(),
        pasteFormat: 'markdown' as const,
      },
      style: { width: 400, height: 500 }
    });
    
    // Simple grid layout for imported nodes
    x += 450;
    if (x > 1800) {
      x = 0;
      y += 550;
    }
  };

  tokens.forEach((token) => {
    if (token.type === 'heading' && token.depth <= 2) {
      // Create node for previous section if it exists
      if (currentContent || currentTitle !== 'Imported Note') {
        createNode(currentTitle, currentContent);
      }
      currentTitle = token.text;
      currentContent = '';
    } else {
      // Append content to current section
      if (token.type === 'space') {
        currentContent += '\n';
      } else if ('raw' in token) {
        currentContent += token.raw;
      }
    }
  });

  // Last section
  createNode(currentTitle, currentContent);

  return nodes;
}

/**
 * @function parseNotionHtmlToNodes
 * @description Handles Notion HTML exports (and other rich HTML sources).
 *
 * Improvements over the previous implementation:
 *  - Uses `normalizeHtml()` instead of `.innerText` to preserve formatting
 *  - Sets `pasteFormat: 'html'` so NoteEditor renders HTML structure, not raw text
 *  - Fallback uses `innerHTML` + normalization instead of `innerText` blob
 *
 * @param html - Raw HTML string from Notion export or clipboard
 * @returns Array of canvas node definitions
 */
export function parseNotionHtmlToNodes(html: string): ImportedNode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nodes: ImportedNode[] = [];
  
  let x = 0;
  let y = 0;

  const addNode = (title: string, htmlContent: string) => {
    // Normalize the HTML to remove Notion wrappers, Word styles, etc.
    const cleanHtml = normalizeHtml(htmlContent);
    // Only add if there's real content
    if (!cleanHtml.trim() || cleanHtml.trim() === '<p></p>') return;

    nodes.push({
      type: 'aiNote',
      position: { x, y },
      data: {
        title,
        content: cleanHtml,     // Fallback plain representation
        pasteContent: cleanHtml, // Rich HTML for NoteEditor to render
        pasteFormat: 'html' as const,
      },
      style: { width: 420, height: 600 },
    });

    x += 450;
    if (x > 1800) {
      x = 0;
      y += 650;
    }
  };

  // Notion exports use headers (H1/H2/H3) as section dividers
  const sections = doc.querySelectorAll('h1, h2, h3');

  if (sections.length === 0) {
    // Fallback: entire body as a single note
    const title = doc.title?.trim() || 'Notion Import';
    const bodyHtml = doc.body?.innerHTML || '';
    addNode(title, bodyHtml);
    return nodes;
  }

  sections.forEach((header) => {
    const headerTitle = (header as HTMLElement).textContent?.trim() || 'Section';
    
    // Collect sibling elements until the next header
    let sectionHtml = '';
    let next = header.nextElementSibling;
    while (next && !['H1', 'H2', 'H3'].includes(next.tagName)) {
      sectionHtml += next.outerHTML;
      next = next.nextElementSibling;
    }

    if (sectionHtml.trim()) {
      addNode(headerTitle, sectionHtml);
    } else {
      // Header with no content — create minimal note
      addNode(headerTitle, `<p>${headerTitle}</p>`);
    }
  });

  return nodes;
}
