import React, { useState } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useNodes, useEdges, type Node } from '@xyflow/react';
import { Copy, ArrowUp, ArrowDown, Trash2, Link2, Palette, Sparkles, GraduationCap, Loader2, Star, Lock, Unlock, Tag, Minimize2, Maximize2, Smile, CalendarDays, SlidersHorizontal, Maximize } from 'lucide-react';
import { toast } from 'sonner';
import { WORKER_URL } from '@/lib/firebase/client';
import { Slider } from '@/components/ui/slider';

const presetColors = [
  { name: 'default', color: 'hsl(0 0% 40%)' },
  { name: 'blue', color: 'hsl(217, 91%, 60%)' },
  { name: 'green', color: 'hsl(142, 76%, 46%)' },
  { name: 'red', color: 'hsl(0, 84%, 60%)' },
  { name: 'purple', color: 'hsl(262, 83%, 58%)' },
  { name: 'yellow', color: 'hsl(52, 100%, 50%)' },
  { name: 'orange', color: 'hsl(25, 95%, 53%)' },
  { name: 'cyan', color: 'hsl(188, 85%, 50%)' },
];

const EMOJI_PRESETS = ['📚', '🔥', '⭐', '💡', '🎯', '📝', '🚀', '💎', '🧠', '📌', '✅', '❌', '⚡', '🎨', '🔬', '📊', '🎵', '🏆', '💬', '🔒'];

interface AISummarizeResponse {
  title?: string;
  bullets?: string[];
}

interface AIFlashcardsResponse {
  flashcards?: Array<{ front: string; back: string }>;
}

function extractTextFromTiptap(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content !== null) {
    const c = content as { text?: string; content?: unknown[] };
    if (c.text) return c.text;
    if (c.content && Array.isArray(c.content)) {
      return c.content.map(extractTextFromTiptap).join(' ');
    }
  }
  return '';
}

function getNodeTextContent(node: Node): string {
  const d = node.data as Record<string, unknown> || {};
  const parts: string[] = [];
  if (d.title) parts.push(d.title as string);
  if (d.content) parts.push(extractTextFromTiptap(d.content));
  if (d.bullets) parts.push((d.bullets as string[]).join('\n'));
  if (d.questions) parts.push((d.questions as string[]).join('\n'));
  return parts.join('\n');
}

export function NodeContextMenu() {
  const nodeContextMenu = useCanvasStore((s) => s.nodeContextMenu);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const nodes = useNodes();
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const addNode = useCanvasStore((s) => s.addNode);
  const edges = useEdges();
  const [showColors, setShowColors] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showOpacity, setShowOpacity] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  if (!nodeContextMenu) return null;

  const { x, y, nodeId } = nodeContextMenu;
  const node = nodes.find(n => n.id === nodeId);
  const nodeType = node?.type;
  const supportsColor = nodeType === 'summary' || nodeType === 'group' || nodeType === 'termQuestion' || nodeType === 'stickyNote';
  const supportsAI = nodeType === 'aiNote' || nodeType === 'lectureNotes' || nodeType === 'summary' || nodeType === 'termQuestion';
  const isPinned = (node?.data as { pinned?: boolean })?.pinned;
  const isLocked = (node?.data as { locked?: boolean })?.locked;
  const isCollapsed = (node?.data as { collapsed?: boolean })?.collapsed;
  const nodeTags: string[] = (node?.data as { tags?: string[] })?.tags || [];
  const currentEmoji: string = (node?.data as { emoji?: string })?.emoji || '';
  const currentOpacity: number = (node?.data as { opacity?: number })?.opacity ?? 100;

  const TAG_PRESETS = ['Important', 'Review', 'Done', 'Todo', 'Question', 'Idea'];
  const TAG_COLORS: Record<string, string> = {
    'Important': 'bg-red text-red-foreground',
    'Review': 'bg-orange text-orange-foreground',
    'Done': 'bg-green text-green-foreground',
    'Todo': 'bg-yellow text-yellow-foreground',
    'Question': 'bg-purple text-purple-foreground',
    'Idea': 'bg-cyan text-cyan-foreground',
  };

  const toggleTag = (tag: string) => {
    const current: string[] = (node?.data as { tags?: string[] })?.tags || [];
    const updated = current.includes(tag) ? current.filter((t: string) => t !== tag) : [...current, tag];
    updateNodeData(nodeId, { tags: updated });
  };

  const handleAction = (action: () => void) => {
    action();
    setNodeContextMenu(null);
    setShowColors(false);
    setShowEmojis(false);
    setShowOpacity(false);
    setShowTags(false);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/workspace/${workspaceId}?nodeId=${nodeId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  const handleColorChange = (colorName: string) => {
    updateNodeData(nodeId, { color: colorName });
    setNodeContextMenu(null);
    setShowColors(false);
  };

  const handleSetDueDate = () => {
    const dateStr = prompt('Enter due date (YYYY-MM-DD):');
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        updateNodeData(nodeId, { dueDate: parsed.toISOString() });
        toast.success('Due date set');
      } else {
        toast.error('Invalid date format');
      }
    }
    setNodeContextMenu(null);
  };

  const handleClearDueDate = () => {
    updateNodeData(nodeId, { dueDate: undefined });
    toast.success('Due date cleared');
    setNodeContextMenu(null);
  };

  const handleAutoFit = () => {
    const el = document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement;
    if (el) {
      const inner = el.querySelector('.react-flow__node') as HTMLElement || el;
      const scrollW = Math.max(inner.scrollWidth, 200);
      const scrollH = Math.max(inner.scrollHeight, 100);
      useCanvasStore.setState({
        nodes: useCanvasStore.getState().nodes.map(n =>
          n.id === nodeId ? { ...n, style: { ...n.style, width: scrollW + 20, height: scrollH + 20 } } : n
        ),
      });
      toast.success('Node resized to fit content');
    }
    setNodeContextMenu(null);
  };

  const handleAISummarize = async () => {
    if (!node) return;
    setAiLoading('summarize');
    try {
      const textContent = getNodeTextContent(node);
      if (!textContent.trim()) { toast.error('Node has no text content to summarize'); return; }
      const response = await fetch(`${WORKER_URL}/api/aiStudy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarize', content: textContent })
      });
      const { data, error } = await response.json() as { data: AISummarizeResponse; error?: string };
      if (error) throw new Error(error);
      const result = data;
      if (!result?.bullets) throw new Error('Invalid response');
      addNode({
        id: crypto.randomUUID(),
        type: 'summary' as const,
        position: { x: (node.position?.x || 0) + ((node.style?.width as number) || 300) + 60, y: node.position?.y || 0 },
        data: { title: result.title || 'AI Summary', bullets: result.bullets, color: 'cyan', createdAt: new Date().toISOString() },
        style: { width: 300, height: 340 },
      });
      toast.success('Summary generated!');
    } catch (err: unknown) { console.error(err); toast.error('Failed to generate summary'); }
    finally { setAiLoading(null); setNodeContextMenu(null); }
  };

  const handleAIFlashcards = async () => {
    if (!node) return;
    setAiLoading('flashcards');
    try {
      const textContent = getNodeTextContent(node);
      if (!textContent.trim()) { toast.error('Node has no text content'); return; }
      const response = await fetch(`${WORKER_URL}/api/aiStudy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flashcards', content: textContent })
      });
      const { data, error } = await response.json() as { data: AIFlashcardsResponse; error?: string };
      if (error) throw new Error(error);
      const result = data;
      if (!result?.flashcards?.length) throw new Error('Invalid response');
      const title = (node.data as { title?: string })?.title || 'Note';
      addNode({
        id: crypto.randomUUID(),
        type: 'flashcard' as const,
        position: { x: (node.position?.x || 0) + ((node.style?.width as number) || 300) + 60, y: (node.position?.y || 0) + 60 },
        data: { flashcards: result.flashcards, sourceTitle: title, createdAt: new Date().toISOString() },
        style: { width: 320, height: 300 },
      });
      toast.success(`${result.flashcards.length} flashcards generated!`);
    } catch (err: unknown) { console.error(err); toast.error('Failed to generate flashcards'); }
    finally { setAiLoading(null); setNodeContextMenu(null); }
  };

  const hasDueDate = !!(node?.data as { dueDate?: string })?.dueDate;

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        onClick={() => { setNodeContextMenu(null); setShowColors(false); setShowTags(false); setShowEmojis(false); setShowOpacity(false); }}
        onContextMenu={(e) => { e.preventDefault(); setNodeContextMenu(null); }}
      />
      <div
        className="fixed z-50 min-w-[200px] max-h-[80vh] overflow-y-auto rounded-lg border-2 border-border bg-card p-1.5 shadow-[4px_4px_0px_hsl(0,0%,15%)] animate-brutal-pop"
        style={{
          left: Math.min(x, window.innerWidth - 220),
          top: Math.min(y, window.innerHeight - 400),
        }}
      >
        {/* AI Actions */}
        {supportsAI && (
          <>
            <CtxBtn onClick={handleAISummarize} disabled={aiLoading !== null}>
              {aiLoading === 'summarize' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Summarize with AI
            </CtxBtn>
            <CtxBtn onClick={handleAIFlashcards} disabled={aiLoading !== null}>
              {aiLoading === 'flashcards' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
              Generate Flashcards
            </CtxBtn>
            <div className="my-1 h-0.5 bg-border" />
          </>
        )}

        {/* Collapse */}
        <CtxBtn onClick={() => handleAction(() => { updateNodeData(nodeId, { collapsed: !isCollapsed }); toast.success(isCollapsed ? 'Expanded' : 'Collapsed'); })}>
          {isCollapsed ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          {isCollapsed ? 'Expand' : 'Collapse'}
        </CtxBtn>

        <CtxBtn onClick={() => handleAction(() => { updateNodeData(nodeId, { pinned: !isPinned }); toast.success(isPinned ? 'Unpinned' : 'Pinned'); })}>
          <Star className={`h-4 w-4 ${isPinned ? 'fill-primary text-primary' : ''}`} /> {isPinned ? 'Unpin' : 'Pin'}
        </CtxBtn>
        <CtxBtn onClick={() => handleAction(() => { updateNodeData(nodeId, { locked: !isLocked }); toast.success(isLocked ? 'Unlocked' : 'Locked'); })}>
          {isLocked ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4" />} {isLocked ? 'Unlock' : 'Lock'}
        </CtxBtn>
        <CtxBtn onClick={() => handleAction(() => duplicateNode(nodeId))}>
          <Copy className="h-4 w-4" /> Duplicate
        </CtxBtn>
        <CtxBtn onClick={() => handleAction(handleCopyLink)}>
          <Link2 className="h-4 w-4" /> Copy Link
        </CtxBtn>

        {/* Auto-fit */}
        <CtxBtn onClick={handleAutoFit}>
          <Maximize className="h-4 w-4" /> Auto-fit Size
        </CtxBtn>

        <div className="my-1 h-0.5 bg-border" />

        {/* Emoji picker */}
        <div className="relative">
          <CtxBtn onClick={() => { setShowEmojis(!showEmojis); setShowColors(false); setShowTags(false); setShowOpacity(false); }}>
            <Smile className="h-4 w-4" /> {currentEmoji ? `Emoji: ${currentEmoji}` : 'Set Emoji'}
          </CtxBtn>
          {showEmojis && (
            <div className="absolute left-full top-0 ml-1 grid grid-cols-5 gap-1 rounded-lg border-2 border-border bg-card p-2 shadow-[4px_4px_0px_hsl(0,0%,15%)] min-w-[160px]">
              {currentEmoji && (
                <button
                  className="col-span-5 rounded px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-accent"
                  onClick={() => { updateNodeData(nodeId, { emoji: undefined }); setShowEmojis(false); }}
                >
                  Clear emoji
                </button>
              )}
              {EMOJI_PRESETS.map((em) => (
                <button
                  key={em}
                  className={`flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-accent transition-transform hover:scale-125 ${currentEmoji === em ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => { updateNodeData(nodeId, { emoji: em }); setShowEmojis(false); }}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Due date */}
        <CtxBtn onClick={hasDueDate ? handleClearDueDate : handleSetDueDate}>
          <CalendarDays className="h-4 w-4" /> {hasDueDate ? 'Clear Due Date' : 'Set Due Date'}
        </CtxBtn>

        {/* Opacity */}
        <div className="relative">
          <CtxBtn onClick={() => { setShowOpacity(!showOpacity); setShowColors(false); setShowTags(false); setShowEmojis(false); }}>
            <SlidersHorizontal className="h-4 w-4" /> Opacity: {currentOpacity}%
          </CtxBtn>
          {showOpacity && (
            <div className="absolute left-full top-0 ml-1 flex items-center gap-2 rounded-lg border-2 border-border bg-card p-3 shadow-[4px_4px_0px_hsl(0,0%,15%)] min-w-[180px]">
              <Slider
                value={[currentOpacity]}
                min={25}
                max={100}
                step={5}
                onValueChange={([v]) => updateNodeData(nodeId, { opacity: v })}
                className="w-[120px]"
              />
              <span className="text-xs font-bold text-muted-foreground w-8">{currentOpacity}%</span>
            </div>
          )}
        </div>

        {supportsColor && (
          <div className="relative">
            <CtxBtn onClick={() => { setShowColors(!showColors); setShowEmojis(false); setShowTags(false); setShowOpacity(false); }}>
              <Palette className="h-4 w-4" /> Change Color
            </CtxBtn>
            {showColors && (
              <div className="absolute left-full top-0 ml-1 flex gap-1.5 rounded-lg border-2 border-border bg-card p-2.5 shadow-[4px_4px_0px_hsl(0,0%,15%)]">
                {presetColors.map((c) => (
                  <button
                    key={c.name}
                    className="h-6 w-6 rounded border-2 border-border transition-transform hover:scale-125"
                    style={{ backgroundColor: c.color }}
                    onClick={() => handleColorChange(c.name)}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="relative">
          <CtxBtn onClick={() => { setShowTags(!showTags); setShowColors(false); setShowEmojis(false); setShowOpacity(false); }}>
            <Tag className="h-4 w-4" /> Tags {nodeTags.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{nodeTags.length}</span>}
          </CtxBtn>
          {showTags && (
            <div className="absolute left-full top-0 ml-1 flex flex-col gap-1 rounded-lg border-2 border-border bg-card p-2 shadow-[4px_4px_0px_hsl(0,0%,15%)] min-w-[130px]">
              {TAG_PRESETS.map((tag) => (
                <button
                  key={tag}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-xs font-bold transition-all ${nodeTags.includes(tag) ? 'ring-2 ring-primary' : ''
                    } ${TAG_COLORS[tag] || 'bg-muted text-foreground'}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="my-1 h-0.5 bg-border" />

        <CtxBtn onClick={() => handleAction(() => bringToFront(nodeId))}>
          <ArrowUp className="h-4 w-4" /> Bring to Front
        </CtxBtn>
        <CtxBtn onClick={() => handleAction(() => sendToBack(nodeId))}>
          <ArrowDown className="h-4 w-4" /> Send to Back
        </CtxBtn>

        <div className="my-1 h-0.5 bg-border" />

        <button
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => handleAction(() => deleteNode(nodeId))}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </>
  );
}

const CtxBtn = React.forwardRef<HTMLButtonElement, { children: React.ReactNode; onClick: () => void; disabled?: boolean }>(
  ({ children, onClick, disabled }, ref) => (
    <button
      ref={ref}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
);
CtxBtn.displayName = 'CtxBtn';
