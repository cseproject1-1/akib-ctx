import { type Node } from '@xyflow/react';
import { marked } from 'marked';

interface ImportedNode {
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  style?: { width: number; height: number };
}

/**
 * Parses markdown content and converts it into canvas nodes.
 * Headings (H1, H2) become individual notes or grouped headers.
 * Sections between headers become content within those nodes.
 */
export function parseMarkdownToNodes(content: string): ImportedNode[] {
  const tokens = marked.lexer(content);
  const nodes: ImportedNode[] = [];
  
  let currentTitle = 'Imported Note';
  let currentContent = '';
  let x = 0;
  let y = 0;

  const createNode = (title: string, content: string) => {
    if (!content.trim() && title === 'Imported Note') return;
    
    nodes.push({
      type: 'aiNote',
      position: { x, y },
      data: {
        title: title || 'Untitled Section',
        content: content.trim(),
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
      // We convert token back to markdown string roughly
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
 * Handles Notion HTML exports.
 * Notion HTML is more complex, but we can extract headings and div blocks.
 */
export function parseNotionHtmlToNodes(html: string): ImportedNode[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const nodes: ImportedNode[] = [];
    
    let x = 0;
    let y = 0;

    // Notion exports often use headers for sections
    const sections = doc.querySelectorAll('h1, h2, h3');
    
    if (sections.length === 0) {
        // Fallback: just take the body text
        nodes.push({
            type: 'aiNote',
            position: { x: 0, y: 0 },
            data: { title: doc.title || 'Notion Import', content: doc.body.innerText },
            style: { width: 420, height: 600 }
        });
        return nodes;
    }

    sections.forEach((header) => {
        let content = '';
        let next = header.nextElementSibling;
        
        while (next && !['H1', 'H2', 'H3'].includes(next.tagName)) {
            content += (next as HTMLElement).innerText + '\n\n';
            next = next.nextElementSibling;
        }

        nodes.push({
            type: 'aiNote',
            position: { x, y },
            data: { title: (header as HTMLElement).innerText, content: content.trim() },
            style: { width: 400, height: 500 }
        });

        x += 450;
        if (x > 1800) {
            x = 0;
            y += 550;
        }
    });

    return nodes;
}
