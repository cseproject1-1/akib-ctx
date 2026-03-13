import React, { useState } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useNodes, type Node } from '@xyflow/react';
import { Copy, ArrowUp, ArrowDown, Trash2, Link2, Palette, Sparkles, GraduationCap, Loader2, Star, Lock, Unlock, Tag, Minimize2, Maximize2, Smile, CalendarDays, SlidersHorizontal, Maximize } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
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
    <AnimatePresence>
      {nodeContextMenu && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/5 backdrop-blur-[1px]"
            onClick={() => { setNodeContextMenu(null); setShowColors(false); setShowTags(false); setShowEmojis(false); setShowOpacity(false); }}
            onContextMenu={(e) => { e.preventDefault(); setNodeContextMenu(null); }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute z-[100] min-w-[240px] max-h-[85vh] overflow-y-auto scrollbar-none rounded-[2rem] glass-morphism-strong p-2 pro-shadow border border-white/5"
            style={{
              left: x + 260 > window.innerWidth ? x - 260 : x,
              top: Math.min(y, window.innerHeight - 500),
            }}
          >
            <div className="px-4 py-3 border-b border-white/5 mb-1.5 flex items-center justify-between bg-white/5 rounded-t-[1.8rem]">
               <p className="text-[10px] font-black text-foreground/40 uppercase tracking-[3px]">Node Control</p>
               <div className="flex gap-1.5 items-center">
                 <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse" />
                 <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">{nodeType}</span>
               </div>
            </div>

            <div className="px-1.5 pb-1.5 space-y-1">
              <div className="group/section space-y-0.5">
                <CtxBtn onClick={handleAISummarize} disabled={aiLoading !== null} className="text-primary hover:bg-primary/10 rounded-xl">
                  {aiLoading === 'summarize' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Summarize with AI
                </CtxBtn>
                <CtxBtn onClick={handleAIFlashcards} disabled={aiLoading !== null} className="text-primary hover:bg-primary/10 rounded-xl">
                  {aiLoading === 'flashcards' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                  Generate Flashcards
                </CtxBtn>
              </div>

              <div className="my-2 h-px bg-white/5 mx-2" />

              <div className="grid grid-cols-2 gap-1 px-1">
                <CtxBtn 
                  className="flex-col items-start gap-1 p-3 rounded-[1.25rem] bg-white/5 hover:bg-white/10"
                  onClick={() => handleAction(() => { updateNodeData(nodeId, { collapsed: !isCollapsed }); toast.success(isCollapsed ? 'Expanded' : 'Collapsed'); })}
                >
                  {isCollapsed ? <Maximize2 className="h-4 w-4 text-primary" /> : <Minimize2 className="h-4 w-4 text-primary" />}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">{isCollapsed ? 'Expand' : 'Collapse'}</span>
                </CtxBtn>
                <CtxBtn 
                  className="flex-col items-start gap-1 p-3 rounded-[1.25rem] bg-white/5 hover:bg-white/10"
                  onClick={() => handleAction(() => { updateNodeData(nodeId, { pinned: !isPinned }); toast.success(isPinned ? 'Unpinned' : 'Pinned'); })}
                >
                  <Star className={cn("h-4 w-4 transition-colors", isPinned ? "fill-primary text-primary" : "text-primary")} /> 
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">{isPinned ? 'Unpin' : 'Pin'}</span>
                </CtxBtn>
              </div>

              <div className="space-y-0.5 mt-2">
                <CtxBtn onClick={() => handleAction(() => { updateNodeData(nodeId, { locked: !isLocked }); toast.success(isLocked ? 'Unlocked' : 'Locked'); })}>
                  {isLocked ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4" />} {isLocked ? 'Unlock' : 'Lock'}
                </CtxBtn>
                <CtxBtn onClick={() => handleAction(() => duplicateNode(nodeId))}>
                  <Copy className="h-4 w-4" /> Duplicate
                </CtxBtn>
                <CtxBtn onClick={() => handleAction(handleCopyLink)}>
                  <Link2 className="h-4 w-4" /> Copy Link
                </CtxBtn>
                <CtxBtn onClick={handleAutoFit}>
                  <Maximize className="h-4 w-4" /> Auto-fit Size
                </CtxBtn>
              </div>

              <div className="my-2 h-px bg-white/5 mx-2" />

              <div className="space-y-0.5">
                {/* Emoji Submenu */}
                <div className="relative">
                  <CtxBtn onClick={() => { setShowEmojis(!showEmojis); setShowColors(false); setShowTags(false); setShowOpacity(false); }} className={cn(showEmojis && "bg-white/10")}>
                    <Smile className="h-4 w-4" /> Emoji {currentEmoji && <span className="ml-auto text-lg">{currentEmoji}</span>}
                  </CtxBtn>
                  <AnimatePresence>
                    {showEmojis && (
                      <motion.div
                        initial={{ opacity: 0, x: x + 400 > window.innerWidth ? 10 : -10, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: x + 400 > window.innerWidth ? 10 : -10, scale: 0.9 }}
                        className={cn(
                          "absolute top-0 grid grid-cols-5 gap-1.5 rounded-[1.5rem] glass-morphism-strong p-3 pro-shadow border border-white/10 min-w-[210px] z-[110]",
                          x + 400 > window.innerWidth ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]"
                        )}
                      >
                        {EMOJI_PRESETS.map((em) => (
                          <button
                            key={em}
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-xl text-lg hover:bg-white/10 transition-all hover:scale-110",
                              currentEmoji === em && "bg-primary/20 ring-1 ring-primary/40"
                            )}
                            onClick={() => { updateNodeData(nodeId, { emoji: em }); setShowEmojis(false); }}
                          >
                            {em}
                          </button>
                        ))}
                        {currentEmoji && (
                          <button
                            className="col-span-5 mt-2 rounded-xl bg-white/5 px-2 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => { updateNodeData(nodeId, { emoji: undefined }); setShowEmojis(false); }}
                          >
                            Clear Emoji
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <CtxBtn onClick={hasDueDate ? handleClearDueDate : handleSetDueDate}>
                  <CalendarDays className="h-4 w-4" /> {hasDueDate ? 'Clear Due Date' : 'Set Due Date'}
                </CtxBtn>

                {/* Opacity Submenu */}
                <div className="relative">
                  <CtxBtn onClick={() => { setShowOpacity(!showOpacity); setShowColors(false); setShowTags(false); setShowEmojis(false); }} className={cn(showOpacity && "bg-white/10")}>
                    <SlidersHorizontal className="h-4 w-4" /> Opacity <span className="ml-auto text-[10px] font-bold text-primary">{currentOpacity}%</span>
                  </CtxBtn>
                  <AnimatePresence>
                    {showOpacity && (
                      <motion.div 
                        initial={{ opacity: 0, x: x + 400 > window.innerWidth ? 10 : -10, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: x + 400 > window.innerWidth ? 10 : -10, scale: 0.9 }}
                        className={cn(
                          "absolute top-0 flex flex-col gap-3 rounded-[1.5rem] glass-morphism-strong p-4 pro-shadow border border-white/10 min-w-[200px] z-[110]",
                          x + 400 > window.innerWidth ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]"
                        )}
                      >
                        <p className="text-[9px] font-black text-foreground/40 uppercase tracking-[2px]">Adjust Opacity</p>
                        <div className="flex items-center gap-3">
                          <Slider
                            value={[currentOpacity]}
                            min={10}
                            max={100}
                            step={1}
                            onValueChange={([v]) => updateNodeData(nodeId, { opacity: v })}
                            className="w-full"
                          />
                          <span className="text-[11px] font-black text-primary w-10">{currentOpacity}%</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Color Submenu */}
                {supportsColor && (
                  <div className="relative">
                    <CtxBtn onClick={() => { setShowColors(!showColors); setShowEmojis(false); setShowTags(false); setShowOpacity(false); }} className={cn(showColors && "bg-white/10")}>
                      <Palette className="h-4 w-4" /> Node Theme
                    </CtxBtn>
                    <AnimatePresence>
                      {showColors && (
                        <motion.div 
                          initial={{ opacity: 0, x: x + 400 > window.innerWidth ? 10 : -10, scale: 0.9 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: x + 400 > window.innerWidth ? 10 : -10, scale: 0.9 }}
                          className={cn(
                            "absolute top-0 grid grid-cols-4 gap-2 rounded-[1.5rem] glass-morphism-strong p-3 pro-shadow border border-white/10 z-[110]",
                            x + 400 > window.innerWidth ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]"
                          )}
                        >
                          {presetColors.map((c) => (
                            <button
                              key={c.name}
                              className="h-8 w-8 rounded-full border border-white/10 transition-all hover:scale-125 hover:rotate-12 ring-offset-2 hover:ring-2 hover:ring-white/20"
                              style={{ backgroundColor: c.color }}
                              onClick={() => handleColorChange(c.name)}
                              title={c.name}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Tags Submenu */}
                <div className="relative">
                  <CtxBtn onClick={() => { setShowTags(!showTags); setShowColors(false); setShowEmojis(false); setShowOpacity(false); }} className={cn(showTags && "bg-white/10")}>
                    <Tag className="h-4 w-4" /> Tags {nodeTags.length > 0 && <span className="ml-auto text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-black">{nodeTags.length}</span>}
                  </CtxBtn>
                  <AnimatePresence>
                    {showTags && (
                      <motion.div 
                        initial={{ opacity: 0, x: x + 400 > window.innerWidth ? 10 : -10, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: x + 400 > window.innerWidth ? 10 : -10, scale: 0.9 }}
                        className={cn(
                          "absolute top-0 flex flex-col gap-1.5 rounded-[1.5rem] glass-morphism-strong p-3 pro-shadow border border-white/10 min-w-[160px] z-[110]",
                          x + 400 > window.innerWidth ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]"
                        )}
                      >
                        {TAG_PRESETS.map((tag) => (
                          <button
                            key={tag}
                            className={cn(
                              "flex items-center gap-2 rounded-[0.75rem] px-3 py-2 text-[11px] font-black tracking-widest uppercase transition-all hover:brightness-110",
                              nodeTags.includes(tag) ? "ring-2 ring-primary/40 shadow-lg shadow-primary/20" : "opacity-60 hover:opacity-100",
                              TAG_COLORS[tag] || "bg-muted text-foreground"
                            )}
                            onClick={() => toggleTag(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="my-2 h-px bg-white/5 mx-2" />

              <div className="space-y-0.5">
                <CtxBtn onClick={() => handleAction(() => bringToFront(nodeId))}>
                  <ArrowUp className="h-4 w-4" /> Bring to Front
                </CtxBtn>
                <CtxBtn onClick={() => handleAction(() => sendToBack(nodeId))}>
                  <ArrowDown className="h-4 w-4" /> Send to Back
                </CtxBtn>
              </div>

              <div className="my-2 h-px bg-white/5 mx-2" />

              <CtxBtn 
                onClick={() => handleAction(() => deleteNode(nodeId))}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl"
              >
                <Trash2 className="h-4 w-4" /> Delete Node
              </CtxBtn>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const CtxBtn = React.forwardRef<HTMLButtonElement, { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }>(
  ({ children, onClick, disabled, className }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-foreground/80 transition-all hover:bg-white/5 hover:text-foreground disabled:opacity-40",
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  )
);
CtxBtn.displayName = 'CtxBtn';
