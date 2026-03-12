import { JSONContent } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { createLowlight, all } from 'lowlight';
import { toHtml } from 'hast-util-to-html';

const lowlight = createLowlight(all);

interface EditorGhostProps {
  content: JSONContent | null | undefined;
  className?: string;
  placeholder?: string;
}

export function EditorGhost({ content, className, placeholder }: EditorGhostProps) {
  const renderedContent = useMemo(() => {
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

function renderNodes(nodes: JSONContent[]): React.ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${node.type}-${i}`;
    
    switch (node.type) {
      case 'paragraph': {
        return <p key={key}>{renderNodes(node.content || [])}</p>;
      }
      case 'heading': {
        const Level = `h${node.attrs?.level || 1}` as any;
        return <Level key={key}>{renderNodes(node.content || [])}</Level>;
      }
      case 'text': {
        let text: React.ReactNode = node.text;
        if (node.marks) {
          node.marks.forEach(mark => {
            if (mark.type === 'bold') text = <strong key={`${key}-bold`}>{text}</strong>;
            if (mark.type === 'italic') text = <em key={`${key}-italic`}>{text}</em>;
            if (mark.type === 'strike') text = <s key={`${key}-strike`}>{text}</s>;
            if (mark.type === 'code') text = <code key={`${key}-code`} className="bg-muted px-1 rounded text-xs">{text}</code>;
            if (mark.type === 'highlight') {
              text = <mark key={`${key}-highlight`} style={{ backgroundColor: mark.attrs?.color }}>{text}</mark>;
            }
          });
        }
        return <span key={key}>{text}</span>;
      }
      case 'bulletList':
        return <ul key={key}>{renderNodes(node.content || [])}</ul>;
      case 'orderedList':
        return <ol key={key}>{renderNodes(node.content || [])}</ol>;
      case 'listItem':
        return <li key={key}>{renderNodes(node.content || [])}</li>;
      case 'taskList':
        return <ul key={key} className="list-none pl-0">{renderNodes(node.content || [])}</ul>;
      case 'taskItem':
        return (
          <li key={key} className="flex items-center gap-2">
            <input type="checkbox" checked={node.attrs?.checked} readOnly className="h-3 w-3 rounded border-border" />
            <span className={node.attrs?.checked ? 'line-through text-muted-foreground' : ''}>
              {renderNodes(node.content || [])}
            </span>
          </li>
        );
      case 'blockquote': {
        return <blockquote key={key}>{renderNodes(node.content || [])}</blockquote>;
      }
      case 'codeBlock': {
        const language = node.attrs?.language || 'plaintext';
        const codeText = node.content?.[0]?.text || '';
        let htmlSnippet = '';
        try {
          const tree = lowlight.highlight(language, codeText);
          htmlSnippet = toHtml(tree);
        } catch {
          htmlSnippet = codeText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        return (
          <pre key={key} className="bg-[#1e1e1e] p-3 rounded-lg text-[11px] font-mono overflow-auto border border-white/5 shadow-xl code-highlight">
            <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: htmlSnippet }} />
          </pre>
        );
      }
      case 'horizontalRule':
        return <hr key={key} />;
      case 'hardBreak':
        return <br key={key} />;
      default:
        return null;
    }
  });
}
