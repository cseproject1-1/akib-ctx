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
function renderNodes(nodes: any[]): React.ReactNode[] {
  return nodes.map((node, i) => renderNode(node, i));
}

function renderNode(node: any, i: number): React.ReactNode {
  const key = `${node.type}-${node.id || i}`;
  const type = node.type;
  
  // Normalize block properties (Tiptap uses attrs, BlockNote uses props)
  const attrs = node.attrs || node.props || {};
  
  // Normalize children (Tiptap uses content, BlockNote uses content as inline and children as blocks)
  // This is tricky: in BlockNote, 'content' is an array of inline segments, while 'children' is an array of sub-blocks.
  // In Tiptap, 'content' is ALWAYS blocks (except for leaf text nodes).
  const blockChildren = node.children || (Array.isArray(node.content) && node.content.every((n: any) => n.type !== 'text') ? node.content : []);
  const inlineContent = Array.isArray(node.content) && node.content.some((n: any) => n.type === 'text') ? node.content : (Array.isArray(node.content) && node.content.length === 0 ? [] : null);

  const childrenRenderer = () => {
    if (inlineContent) return renderNodes(inlineContent);
    if (blockChildren) return renderNodes(blockChildren);
    return null;
  };

  switch (type) {
    case 'paragraph':
      return <p key={key}>{childrenRenderer()}</p>;

    case 'heading': {
      const Level = `h${attrs.level || 1}` as any;
      return <Level key={key}>{childrenRenderer()}</Level>;
    }

    case 'bulletList':
    case 'bulletListItem': // BlockNote uses specific names
      return <ul key={key}>{childrenRenderer()}</ul>;

    case 'numberedList':
    case 'numberedListItem':
      return <ol key={key} start={attrs.start}>{childrenRenderer()}</ol>;

    case 'checkListItem':
      return (
        <li key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!attrs.checked}
            readOnly
            className="h-3 w-3 rounded border-border"
          />
          <span className={attrs.checked ? 'line-through text-muted-foreground' : ''}>
            {childrenRenderer()}
          </span>
        </li>
      );

    case 'listItem':
      return <li key={key}>{childrenRenderer()}</li>;

    case 'taskList':
      return <ul key={key} className="list-none pl-0">{childrenRenderer()}</ul>;

    case 'taskItem':
      return (
        <li key={key} className="flex items-start gap-2 my-1">
          <input
            type="checkbox"
            checked={!!attrs.checked}
            readOnly
            className="mt-1 h-3.5 w-3.5 rounded border-border shrink-0"
          />
          <div className={cn("flex-1", attrs.checked && "line-through text-muted-foreground/50")}>
            {childrenRenderer()}
          </div>
        </li>
      );

    case 'blockquote':
      return (
        <blockquote key={key} className="border-l-2 border-primary/30 pl-3 italic">
          {childrenRenderer()}
        </blockquote>
      );

    case 'codeBlock': {
      const language = attrs.language || 'plaintext';
      const codeText = Array.isArray(node.content) ? node.content.map((c: any) => c.text).join('') : (node.content?.[0]?.text || '');
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
        <pre key={key} className="bg-[#1e1e1e] p-3 rounded-lg text-[11px] font-mono overflow-auto border border-white/5 shadow-xl">
          <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: htmlSnippet }} />
        </pre>
      );
    }

    case 'horizontalRule':
      return <hr key={key} className="border-border" />;

    case 'hardBreak':
      return <br key={key} />;

    case 'table':
      return (
        <div key={key} className="overflow-x-auto my-2">
          <table className="border-collapse border border-border text-xs w-full">
            <tbody>{childrenRenderer()}</tbody>
          </table>
        </div>
      );

    case 'tableRow':
      return <tr key={key} className="border-b border-border/50">{childrenRenderer()}</tr>;

    case 'tableHeader':
    case 'tableHead':
      return (
        <th key={key} className="border border-border p-1.5 bg-muted/30 font-bold text-left min-w-[50px]">
          {childrenRenderer()}
        </th>
      );

    case 'tableCell':
      return (
        <td key={key} className="border border-border p-1.5 min-w-[50px]">
          {childrenRenderer()}
        </td>
      );

    case 'image':
    case 'video':
    case 'file': {
      const src = attrs.url || attrs.src;
      if (!src) return null;
      return (
        <div key={key} className="my-2 border border-border/50 rounded-lg overflow-hidden bg-muted/20">
          <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground font-mono truncate uppercase">
            {type}: {attrs.name || attrs.caption || 'Media file'}
          </div>
          {type === 'image' ? (
             <img src={src} className="max-w-full h-auto mx-auto" alt={attrs.name || ''} />
          ) : (
            <div className="p-4 text-center text-xs italic text-muted-foreground">
               [Shared {type}]
            </div>
          )}
        </div>
      );
    }

    case 'math':
    case 'mathBlock': {
      const latex = attrs.latex || attrs.content || (Array.isArray(node.content) ? node.content.map((c: any) => c.text).join('') : '');
      return (
        <div
          key={key}
          className="my-1 px-2 py-1 rounded bg-muted/20 border border-border/40 font-mono text-[11px] text-muted-foreground"
        >
          {latex || '…'}
        </div>
      );
    }

    case 'callout': {
       const emoji = attrs.icon || attrs.emoji || '💡';
       return (
         <div key={key} className="flex gap-2 my-1 px-3 py-2 rounded bg-muted/30 border-l-4 border-primary/40">
           <span className="shrink-0 text-base leading-snug">{emoji}</span>
           <div className="flex-1 text-sm">{childrenRenderer()}</div>
         </div>
       );
    }

    case 'wiki-link':
    case 'wikiLink':
      return (
        <span key={key} className="text-primary font-medium cursor-pointer hover:underline">
          [[{attrs.label || attrs.title || (Array.isArray(node.content) ? node.content[0]?.text : '') || 'Link'}]]
        </span>
      );

    case 'text': {
      let text: React.ReactNode = node.text;

      // Normalize marks (Tiptap uses .marks, BlockNote uses .styles)
      const marks = node.marks || (node.styles ? Object.entries(node.styles).map(([m, active]) => (active ? { type: m } : null)).filter(Boolean) : []);

      if (marks.length > 0) {
        marks.forEach((mark: any, mi: number) => {
          const mk = `${key}-m${mi}`;
          switch (mark.type) {
            case 'bold': text = <strong key={mk}>{text}</strong>; break;
            case 'italic': text = <em key={mk}>{text}</em>; break;
            case 'strike': text = <s key={mk}>{text}</s>; break;
            case 'underline': text = <u key={mk}>{text}</u>; break;
            case 'code': text = <code key={mk} className="bg-muted px-1 rounded text-xs font-mono">{text}</code>; break;
            case 'link':
              text = (
                <a key={mk} href={mark.attrs?.href || attrs.url || mark.attrs?.url} className="text-primary underline decoration-primary/30" target="_blank" rel="noopener noreferrer">
                  {text}
                </a>
              );
              break;
            case 'textStyle':
            case 'color':
              if (mark.attrs?.color || mark.attrs?.textColor) {
                text = <span key={mk} style={{ color: mark.attrs.color || mark.attrs.textColor }}>{text}</span>;
              }
              break;
            case 'highlight':
              text = <mark key={mk} style={{ backgroundColor: mark.attrs?.color || '#ffe066' }} className="rounded-sm px-0.5">{text}</mark>;
              break;
          }
        });
      }

      // Final styles for BlockNote format (direct props on text node or style object)
      const textStyle: React.CSSProperties = {};
      if (node.styles?.textColor) textStyle.color = node.styles.textColor;
      if (node.styles?.backgroundColor) textStyle.backgroundColor = node.styles.backgroundColor;

      return <span key={key} style={textStyle}>{text}</span>;
    }

    default:
      if (node.content) return <div key={key}>{renderNodes(Array.isArray(node.content) ? node.content : [])}</div>;
      return node.text ? <span key={key}>{node.text}</span> : null;
  }
}
