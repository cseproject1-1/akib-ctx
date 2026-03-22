/**
 * Utility to detect and parse various content types from strings.
 * Used for intelligent clipboard processing.
 */
import { normalizeHtml } from '@/lib/editor/htmlNormalizer';

export function extractText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractText).filter(Boolean).join(' ');
  }
  return '';
}

export interface ParsedContent {
  type: string;
  data: Record<string, any>;
  style?: { width: number; height: number };
}

/**
 * Extracts a smart title from content.
 * Looks for H1, first bold line, or first 5 words.
 */
export function extractSmartTitle(content: string, fallback = 'Untitled'): string {
  const trimmed = content.trim();
  if (!trimmed) return fallback;

  // 1. Try to find Markdown H1
  const h1Match = trimmed.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim().slice(0, 60);

  // 2. Try to find the first non-empty line
  const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return fallback;

  const firstLine = lines[0];
  
  // 3. If first line is "bold" (surrounded by ** or __)
  const boldMatch = firstLine.match(/^(\*\*|__)(.+)\1$/);
  if (boldMatch) return boldMatch[2].trim().slice(0, 60);

  // 4. Default to first line if it's reasonably short
  if (firstLine.length <= 60) return firstLine;

  // 5. Take first 5 words
  const words = firstLine.split(/\s+/).slice(0, 5).join(' ');
  return words.length > 57 ? words.slice(0, 57) + '...' : words;
}

/**
 * Detects the content type and returns structured data.
 */
export function parseContent(text: string, html?: string): ParsedContent {
  const trimmed = text.trim();
  
  // 1. Detect Mermaid Diagrams
  //    Route to codeSnippet (not math) so the diagram renderer is used correctly.
  const mermaidKeywords = [
    'graph ', 'sequenceDiagram', 'gantt', 'classDiagram', 'erDiagram',
    'pie', 'flowchart ', 'journey', 'gitGraph', 'mindmap', 'timeline',
    'quadrantChart', 'requirementDiagram',
  ];
  if (mermaidKeywords.some((kw) => trimmed.startsWith(kw))) {
    return {
      type: 'codeSnippet',
      data: { code: trimmed, language: 'mermaid', title: 'Mermaid Diagram' },
      style: { width: 500, height: 400 }
    };
  }

  // 2. Detect JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        type: 'codeSnippet',
        data: { 
          code: JSON.stringify(parsed, null, 2), 
          language: 'json', 
          title: 'JSON Data' 
        },
        style: { width: 450, height: 400 }
      };
    } catch {
      // Not valid JSON, continue
    }
  }

  // 3. Detect CSV/TSV (Simple heuristic: multiple lines, consistent comma/tab count)
  const lines = trimmed.split('\n');
  if (lines.length > 1) {
    const commaCount = (lines[0].match(/,/g) || []).length;
    if (commaCount > 0 && lines.every(l => (l.match(/,/g) || []).length === commaCount)) {
      return {
        type: 'table',
        data: { 
          content: trimmed, 
          title: 'CSV Data',
          format: 'csv'
        },
        style: { width: 600, height: 350 }
      };
    }
  }

  // 4. Detect URLs (Already handled in CanvasWrapper but improved here)
  if (/^https?:\/\/[^\s]+$/.test(trimmed) && !trimmed.includes('\n')) {
    try {
      const url = new URL(trimmed);
      const domain = url.hostname.replace('www.', '');
      return {
        type: 'embed',
        data: { url: trimmed, title: domain },
        style: { width: 450, height: 380 }
      };
    } catch {
      // Not a valid URL
    }
  }

  // 5. Default: AI Note with smart title
  //    When HTML is available, normalize it and store as 'html' format so
  //    the NoteEditor renders it with structure preserved (not as markdown text).
  const hasRichHtml = html && html.trim().length > 0 && /<[a-z]+/i.test(html);
  const pasteContent = hasRichHtml
    ? normalizeHtml(html)
    : trimmed;
  const pasteFormat: 'html' | 'markdown' = hasRichHtml ? 'html' : 'markdown';

  return {
    type: 'aiNote',
    data: {
      title: extractSmartTitle(trimmed, 'Pasted Note'),
      content: trimmed,
      pasteContent,
      pasteFormat,
    },
    style: { width: 420, height: 500 }
  };
}
