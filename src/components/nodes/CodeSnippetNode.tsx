import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Code2, Copy, Check, Expand, ChevronDown } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/store/canvasStore';
import { toast } from 'sonner';
import { createLowlight, all } from 'lowlight';
import { toHtml } from 'hast-util-to-html';
import DOMPurify from 'dompurify';
import { CodeSnippetNodeData } from '@/types/canvas';

const lowlight = createLowlight(all);

const LANGUAGES = [
  'plaintext', 'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp',
  'html', 'css', 'json', 'sql', 'bash', 'rust', 'go', 'ruby', 'php', 'swift', 'kotlin',
];

export const CodeSnippetNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as CodeSnippetNodeData;
  const [editing, setEditing] = useState(!nodeData.code);
  const [editValue, setEditValue] = useState(nodeData.code || '');
  const [copied, setCopied] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const langPickerRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const language = nodeData.language || 'plaintext';

  useEffect(() => {
    if (!editing) {
      setEditValue(nodeData.code || '');
    }
  }, [nodeData.code, editing]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Close language picker on outside click
  useEffect(() => {
    if (!showLangPicker) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
        setShowLangPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showLangPicker]);

  const handleCopy = useCallback(() => {
    if (nodeData.code) {
      navigator.clipboard.writeText(nodeData.code).then(() => {
        setCopied(true);
        toast.success('Code copied');
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        toast.error('Failed to copy code');
      });
    }
  }, [nodeData.code]);

  const handleBlur = useCallback(() => {
    updateNodeData(id, { code: editValue });
    if (editValue.trim()) setEditing(false);
  }, [id, updateNodeData, editValue]);

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Code Snippet'}
      icon={<Code2 className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(title) => updateNodeData(id, { title })}
      bodyClassName="p-0 overflow-auto flex flex-col"
      tags={nodeData.tags}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      color={nodeData.color}
      headerExtra={
        <div className="flex items-center gap-0.5">
          <div className="relative" ref={langPickerRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowLangPicker(!showLangPicker); }}
              className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/header:opacity-100"
            >
              {language}
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border-2 border-border bg-popover p-1 shadow-[4px_4px_0px_hsl(0,0%,10%)]">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={(e) => { e.stopPropagation(); updateNodeData(id, { language: lang }); setShowLangPicker(false); }}
                    className={`block w-full rounded-md px-3 py-1 text-left text-xs font-mono transition-colors hover:bg-accent ${lang === language ? 'text-primary font-bold' : 'text-muted-foreground'}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/header:opacity-100"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            title="Copy code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            className="rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/header:opacity-100"
            onClick={(e) => { e.stopPropagation(); setExpandedNode(id); }}
            title="Expand"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
        </div>
      }
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Tab') {
                e.preventDefault();
                const ta = e.currentTarget;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                const isShift = e.shiftKey;
                
                if (isShift) {
                  // N55: Dedent
                  const lines = editValue.substring(0, start).split('\n');
                  const currentLine = lines[lines.length - 1];
                  if (currentLine.endsWith('  ')) {
                    const newVal = editValue.substring(0, start - 2) + editValue.substring(start);
                    setEditValue(newVal);
                    requestAnimationFrame(() => {
                      ta.selectionStart = ta.selectionEnd = Math.max(0, start - 2);
                    });
                  }
                } else {
                  // Indent
                  const newVal = editValue.substring(0, start) + '  ' + editValue.substring(end);
                  setEditValue(newVal);
                  requestAnimationFrame(() => {
                    ta.selectionStart = ta.selectionEnd = start + 2;
                  });
                }
              }
            }}
            className="w-full flex-1 min-h-[120px] resize-none bg-muted p-4 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Paste or type your code here..."
            spellCheck={false}
          />
        ) : (
          <HighlightedCode code={nodeData.code || '// Double-click to edit'} language={language} onDoubleClick={() => setEditing(true)} />
        )}
        {/* Line count */}
        {nodeData.code && (
          <div className="border-t border-border bg-card px-3 py-1 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
            <span>{nodeData.code.split('\n').length} lines</span>
            <span>{language}</span>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

CodeSnippetNode.displayName = 'CodeSnippetNode';

function HighlightedCode({ code, language, onDoubleClick }: { code: string; language: string; onDoubleClick: () => void }) {
  const html = useMemo(() => {
    try {
      const tree = lowlight.highlight(language, code);
      return toHtml(tree);
    } catch {
      return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }, [code, language]);

  return (
    <pre
      className="code-highlight w-full flex-1 overflow-auto bg-muted p-4 font-mono text-xs text-foreground cursor-text"
      onDoubleClick={onDoubleClick}
    >
      {/* N3 fix: Sanitize highlighted HTML */}
      <code dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
    </pre>
  );
}
