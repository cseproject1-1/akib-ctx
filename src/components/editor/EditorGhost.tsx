import { JSONContent } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { createLowlight, all } from 'lowlight';
import { toHtml } from 'hast-util-to-html';

const lowlight = createLowlight(all);

interface EditorGhostProps {
  content: JSONContent | Record<string, unknown>[] | null | undefined;
  className?: string;
  placeholder?: string;
}

export function EditorGhost({ content, className, placeholder }: EditorGhostProps) {
  const renderedContent = useMemo(() => {
    // Handle BlockNote format (array of blocks)
    if (Array.isArray(content)) {
      if (content.length === 0) {
        return <p className="text-muted-foreground italic text-sm">{placeholder || 'Empty note...'}</p>;
      }
      return renderNodes(content);
    }

    // Handle Tiptap format (object with .content)
    if (!content || !content.content || content.content.length === 0) {
      return <p className="text-muted-foreground italic text-sm">{placeholder || 'Empty note...'}</p>;
    }

    return renderNodes(content.content);
  }, [content, placeholder]);

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none pointer-events-none select-none opacity-80", className)}>
      {renderedContent}
    </div>
  );
}

/**
 * Render a JSON content node tree into React elements.
 *
 * Supported node types (complete list):
 *  Block: paragraph, heading, bulletList, orderedList, listItem,
 *         taskList, taskItem, blockquote, codeBlock, horizontalRule, hardBreak,
 *         table, tableRow, tableHeader, tableCell, image,
 *         mathBlock / math / mathInline (KaTeX),
 *         mermaid / codeSnippet (diagram preview),
 *         callout, details, detailsSummary, detailsContent,
 *         columns, column, caption
 *  Inline: text (with all marks including textStyle, color, keyboard, wikiLink)
 *  Marks:  bold, italic, strike, underline, code, highlight, link,
 *          superscript, subscript, textStyle, keyboard, color
 *  Fallback: any unknown node — renders children so text is never blank
 */
function renderNodes(nodes: JSONContent[]): React.ReactNode[] {
  return nodes.map((node, i) => renderNode(node, i));
}

function renderNode(node: JSONContent, i: number): React.ReactNode {
  const key = `${node.type}-${i}`;

  switch (node.type) {
    // -----------------------------------------------------------------------
    // Standard block nodes
    // -----------------------------------------------------------------------
    case 'paragraph':
      return <p key={key}>{renderNodes(node.content || [])}</p>;

    case 'heading': {
      const Level = `h${node.attrs?.level || 1}` as any;
      return <Level key={key}>{renderNodes(node.content || [])}</Level>;
    }

    case 'bulletList':
      return <ul key={key}>{renderNodes(node.content || [])}</ul>;

    case 'orderedList':
      return <ol key={key} start={node.attrs?.start}>{renderNodes(node.content || [])}</ol>;

    case 'listItem':
      return <li key={key}>{renderNodes(node.content || [])}</li>;

    case 'taskList':
      return <ul key={key} className="list-none pl-0">{renderNodes(node.content || [])}</ul>;

    case 'taskItem':
      return (
        <li key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!node.attrs?.checked}
            readOnly
            className="h-3 w-3 rounded border-border"
          />
          <span className={node.attrs?.checked ? 'line-through text-muted-foreground' : ''}>
            {renderNodes(node.content || [])}
          </span>
        </li>
      );

    case 'blockquote':
      return (
        <blockquote key={key} className="border-l-2 border-primary/30 pl-3 italic">
          {renderNodes(node.content || [])}
        </blockquote>
      );

    case 'codeBlock': {
      const language = node.attrs?.language || 'plaintext';
      const codeText = node.content?.[0]?.text || '';
      let htmlSnippet = '';
      try {
        const tree = lowlight.highlight(language, codeText);
        htmlSnippet = toHtml(tree);
      } catch {
        htmlSnippet = codeText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
      return (
        <pre key={key} className="bg-[#1e1e1e] p-3 rounded-lg text-[11px] font-mono overflow-auto border border-white/5 shadow-xl code-highlight">
          <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: htmlSnippet }} />
        </pre>
      );
    }

    case 'horizontalRule':
      return <hr key={key} className="border-border" />;

    case 'hardBreak':
      return <br key={key} />;

    // -----------------------------------------------------------------------
    // Tables (with colspan / rowspan support)
    // -----------------------------------------------------------------------
    case 'table':
      return (
        <div key={key} className="overflow-x-auto my-2">
          <table className="border-collapse border border-border text-xs">
            <tbody>{renderNodes(node.content || [])}</tbody>
          </table>
        </div>
      );

    case 'tableRow':
      return <tr key={key}>{renderNodes(node.content || [])}</tr>;

    case 'tableHeader':
      return (
        <th
          key={key}
          className="border border-border px-2 py-1 bg-muted/50 font-semibold text-left"
          colSpan={node.attrs?.colspan || 1}
          rowSpan={node.attrs?.rowspan || 1}
        >
          {renderNodes(node.content || [])}
        </th>
      );

    case 'tableCell':
      return (
        <td
          key={key}
          className="border border-border px-2 py-1"
          colSpan={node.attrs?.colspan || 1}
          rowSpan={node.attrs?.rowspan || 1}
        >
          {renderNodes(node.content || [])}
        </td>
      );

    // -----------------------------------------------------------------------
    // Link node (block-level)
    // -----------------------------------------------------------------------
    case 'link':
      return (
        <a
          key={key}
          href={node.attrs?.href}
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {renderNodes(node.content || [])}
        </a>
      );

    // -----------------------------------------------------------------------
    // Image
    // -----------------------------------------------------------------------
    case 'image':
      return (
        <img
          key={key}
          src={node.attrs?.src}
          alt={node.attrs?.alt || ''}
          title={node.attrs?.title}
          className="max-w-full rounded"
          loading="lazy"
        />
      );

    // -----------------------------------------------------------------------
    // Math / KaTeX blocks
    //   mathBlock — displayed (block)
    //   math / mathInline — inline
    // -----------------------------------------------------------------------
    case 'mathBlock':
    case 'math': {
      const latex = node.attrs?.latex || node.attrs?.content || node.content?.[0]?.text || '';
      return (
        <div
          key={key}
          className="my-1 px-2 py-1 rounded bg-muted/20 border border-border/40 font-mono text-[11px] text-muted-foreground"
          title="Math block"
        >
          <span className="select-none pr-1 opacity-50">∑</span>
          {latex || '…'}
        </div>
      );
    }

    case 'mathInline': {
      const latex = node.attrs?.latex || node.attrs?.content || node.content?.[0]?.text || '';
      return (
        <code key={key} className="bg-muted px-1 rounded text-xs font-mono">
          {latex || '∑'}
        </code>
      );
    }

    // -----------------------------------------------------------------------
    // Mermaid / codeSnippet diagram preview
    // -----------------------------------------------------------------------
    case 'mermaid':
    case 'codeSnippet': {
      const code = node.attrs?.code || node.content?.[0]?.text || '';
      const lang = node.attrs?.language || 'code';
      const isMermaid = lang === 'mermaid';
      return (
        <div
          key={key}
          className="my-1 rounded border border-border/40 overflow-hidden"
        >
          <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border-b border-border/30">
            <span className="text-[10px] text-muted-foreground font-mono">
              {isMermaid ? '⬡ Mermaid' : `{ } ${lang}`}
            </span>
          </div>
          <pre className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground max-h-20 overflow-hidden">
            {(code || '').slice(0, 200)}{(code || '').length > 200 ? '…' : ''}
          </pre>
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // Callout block
    // -----------------------------------------------------------------------
    case 'callout': {
      const emoji = node.attrs?.emoji || '💡';
      return (
        <div
          key={key}
          className="flex gap-2 my-1 px-3 py-2 rounded bg-muted/30 border-l-4 border-primary/40"
        >
          <span className="shrink-0 text-base leading-snug" aria-hidden="true">{emoji}</span>
          <div className="flex-1 text-sm">{renderNodes(node.content || [])}</div>
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // Toggle / details blocks
    // -----------------------------------------------------------------------
    case 'details':
      return (
        <details key={key} className="my-1 rounded border border-border/30 overflow-hidden">
          {renderNodes(node.content || [])}
        </details>
      );

    case 'detailsSummary':
    case 'summary':
      return (
        <summary key={key} className="px-3 py-1 bg-muted/20 cursor-pointer text-sm font-medium list-none flex gap-1">
          <span className="text-muted-foreground select-none">▶</span>
          {renderNodes(node.content || [])}
        </summary>
      );

    case 'detailsContent':
      return (
        <div key={key} className="px-3 py-2 text-sm">
          {renderNodes(node.content || [])}
        </div>
      );

    // -----------------------------------------------------------------------
    // Multi-column layout
    // -----------------------------------------------------------------------
    case 'columns':
      return (
        <div key={key} className="flex gap-2 my-1">
          {renderNodes(node.content || [])}
        </div>
      );

    case 'column':
      return (
        <div key={key} className="flex-1 min-w-0">
          {renderNodes(node.content || [])}
        </div>
      );

    // -----------------------------------------------------------------------
    // Caption / figcaption
    // -----------------------------------------------------------------------
    case 'caption':
    case 'figcaption':
      return (
        <figcaption key={key} className="text-xs text-muted-foreground italic text-center mt-1">
          {renderNodes(node.content || [])}
        </figcaption>
      );

    // -----------------------------------------------------------------------
    // Wiki-link (inline node)
    // -----------------------------------------------------------------------
    case 'wiki-link':
    case 'wikiLink': {
      const title = node.attrs?.title || node.attrs?.nodeId || '…';
      return (
        <span
          key={key}
          className="inline-flex items-center gap-0.5 px-1 rounded bg-primary/10 text-primary text-xs font-medium"
        >
          [[{title}]]
        </span>
      );
    }

    // -----------------------------------------------------------------------
    // Text node with marks
    // -----------------------------------------------------------------------
    case 'text': {
      let text: React.ReactNode = node.text;

      if (node.marks) {
        // Apply marks in reverse order so outermost is applied last
        const marks = [...node.marks];
        marks.forEach((mark, mi) => {
          const mk = `${key}-m${mi}`;

          switch (mark.type) {
            case 'bold':
              text = <strong key={mk}>{text}</strong>;
              break;
            case 'italic':
              text = <em key={mk}>{text}</em>;
              break;
            case 'strike':
              text = <s key={mk}>{text}</s>;
              break;
            case 'underline':
              text = <u key={mk}>{text}</u>;
              break;
            case 'code':
              text = <code key={mk} className="bg-muted px-1 rounded text-xs">{text}</code>;
              break;
            case 'highlight':
              text = (
                <mark key={mk} style={{ backgroundColor: mark.attrs?.color }}>
                  {text}
                </mark>
              );
              break;
            case 'link':
              text = (
                <a
                  key={mk}
                  href={mark.attrs?.href}
                  className="text-primary underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {text}
                </a>
              );
              break;
            case 'superscript':
              text = <sup key={mk}>{text}</sup>;
              break;
            case 'subscript':
              text = <sub key={mk}>{text}</sub>;
              break;
            case 'textStyle':
            case 'color': {
              const color = mark.attrs?.color;
              if (color) {
                text = <span key={mk} style={{ color }}>{text}</span>;
              }
              break;
            }
            case 'backgroundColor': {
              const bg = mark.attrs?.color;
              if (bg) {
                text = <span key={mk} style={{ backgroundColor: bg }}>{text}</span>;
              }
              break;
            }
            case 'keyboard':
              text = (
                <kbd
                  key={mk}
                  className="inline-flex items-center rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono shadow-sm"
                >
                  {text}
                </kbd>
              );
              break;
          }
        });
      }

      return <span key={key}>{text}</span>;
    }

    // -----------------------------------------------------------------------
    // Fallback: unknown node types — render children so text is never blank
    // -----------------------------------------------------------------------
    default: {
      const children = node.content;
      if (children && children.length > 0) {
        return (
          <div key={key} className="ghost-unknown-node">
            {renderNodes(children)}
          </div>
        );
      }
      // Leaf node with text
      if (node.text) {
        return <span key={key}>{node.text}</span>;
      }
      return null;
    }
  }
}
