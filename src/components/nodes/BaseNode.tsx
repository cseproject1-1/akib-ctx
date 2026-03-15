import { Handle, Position, useNodeId, useStore, NodeResizer } from '@xyflow/react';
import { memo, useCallback, type ReactNode } from 'react';
import { MoreHorizontal, Lock, ChevronDown, ChevronRight, Expand, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useCanvasStore } from '@/store/canvasStore';
import { motion, AnimatePresence } from 'framer-motion';
import { HANDLE_IDS } from '@/lib/constants/canvas';

const NODE_COLORS: Record<string, { border: string; bg: string }> = {
  blue:    { border: 'border-l-blue-500',   bg: 'bg-blue-500/5' },
  green:   { border: 'border-l-green-500',  bg: 'bg-green-500/5' },
  red:     { border: 'border-l-red-500',    bg: 'bg-red-500/5' },
  purple:  { border: 'border-l-purple-500', bg: 'bg-purple-500/5' },
  yellow:  { border: 'border-l-yellow-400', bg: 'bg-yellow-400/5' },
};

const TAG_COLORS: Record<string, string> = {
  'Important': 'bg-destructive/80 text-destructive-foreground',
  'Review': 'bg-primary/30 text-primary-foreground',
  'Done': 'bg-accent text-accent-foreground',
  'Todo': 'bg-primary/50 text-primary-foreground',
  'Question': 'bg-secondary text-secondary-foreground',
  'Idea': 'bg-muted text-foreground',
};

// Node type visual accents for better differentiation
const NODE_TYPE_ACCENTS: Record<string, { border: string; indicator: string }> = {
  aiNote: { border: 'border-l-primary', indicator: 'bg-primary' },
  summary: { border: 'border-l-yellow', indicator: 'bg-yellow' },
  termQuestion: { border: 'border-l-orange', indicator: 'bg-orange' },
  lectureNotes: { border: 'border-l-cyan', indicator: 'bg-cyan' },
  stickyNote: { border: 'border-l-yellow', indicator: 'bg-yellow' },
  checklist: { border: 'border-l-green', indicator: 'bg-green' },
  pdf: { border: 'border-l-red', indicator: 'bg-red' },
  image: { border: 'border-l-green', indicator: 'bg-green' },
  flashcard: { border: 'border-l-purple', indicator: 'bg-purple' },
  embed: { border: 'border-l-cyan', indicator: 'bg-cyan' },
  math: { border: 'border-l-purple', indicator: 'bg-purple' },
  video: { border: 'border-l-red', indicator: 'bg-red' },
  table: { border: 'border-l-cyan', indicator: 'bg-cyan' },
  codeSnippet: { border: 'border-l-green', indicator: 'bg-green' },
  text: { border: 'border-l-muted-foreground', indicator: 'bg-muted-foreground' },
  drawing: { border: 'border-l-primary', indicator: 'bg-primary' },
};

function getDueDateColor(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (dueDay < today) return 'bg-destructive text-destructive-foreground';
  if (dueDay.getTime() === today.getTime()) return 'bg-primary/60 text-primary-foreground';
  return 'bg-muted text-muted-foreground';
}

interface BaseNodeProps {
  children: ReactNode;
  id?: string;
  title?: string;
  icon?: ReactNode;
  selected?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  onTitleChange?: (title: string) => void;
  handles?: boolean;
  headerExtra?: ReactNode;
  onMenuClick?: (e: React.MouseEvent) => void;
  locked?: boolean;
  tags?: string[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  emoji?: string;
  dueDate?: string;
  opacity?: number;
  createdAt?: string;
  footerStats?: string;
  nodeType?: string;
  color?: string;
  progress?: number;
}

export const BaseNode = memo(({
  children,
  id,
  title,
  icon,
  selected,
  className,
  headerClassName,
  bodyClassName,
  onTitleChange,
  handles = true,
  headerExtra,
  onMenuClick,
  locked,
  tags,
  collapsed,
  onToggleCollapse,
  emoji,
  dueDate,
  opacity = 100,
  createdAt,
  footerStats,
  nodeType,
  color,
  progress,
}: BaseNodeProps) => {
  const nodeTags = tags || [];
  const reactFlowNodeId = useNodeId();
  const nodeId = id || reactFlowNodeId;

  // Performance: Only listen to edge changes for this specific node
  const edgeCount = useStore(useCallback((s) => {
    if (!nodeId) return 0;
    return s.edges.filter(e => e.source === nodeId || e.target === nodeId).length;
  }, [nodeId]));

  const detectedType = useStore((s) => {
    const nid = id || reactFlowNodeId;
    if (!nid) return undefined;
    return s.nodeLookup?.get(nid)?.type;
  });
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const focusedNodeId = useCanvasStore((s) => s.focusedNodeId);
  const isFocused = nodeId && focusedNodeId === nodeId;

  const resolvedType = nodeType || detectedType;
  const accent = resolvedType ? NODE_TYPE_ACCENTS[resolvedType] : undefined;
  const userColor = color && color !== 'default' ? NODE_COLORS[color] : undefined;

  const Wrapper = motion.div;
  const nodeContent = (
    <Wrapper
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: (opacity ?? 100) / 100, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'animate-node-appear transition-all duration-300 group/node flex flex-col h-full overflow-hidden',
        'bg-card border-2 border-border/80 relative',
        selected
          ? 'border-primary shadow-[6px_6px_0px_rgba(0,0,0,0.2)] scale-[1.01] z-50'
          : 'shadow-[4px_4px_0px_rgba(0,0,0,0.1)] hover:scale-[1.005] hover:border-primary/50 hover:shadow-[6px_6px_0px_rgba(0,0,0,0.15)]',
        isFocused && 'ring-4 ring-primary ring-opacity-30 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] animate-pulse border-primary',
        userColor ? `${userColor.bg}` : accent && !selected ? `border-l-4 ${accent.border}` : '',
        className
      )}
    >
      {locked && (
        <div className="absolute top-1.5 right-1.5 z-10 rounded bg-destructive/80 p-0.5">
          <Lock className="h-3 w-3 text-destructive-foreground" />
        </div>
      )}

      {edgeCount > 0 && (
        <div className="absolute -top-2.5 -left-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-border bg-primary text-[9px] font-bold text-primary-foreground shadow-sm">
          {edgeCount}
        </div>
      )}

      {!locked && canvasMode === 'edit' && (
        <NodeResizer
          isVisible={selected}
          minWidth={120}
          minHeight={80}
          onResizeEnd={(_event, params) => {
            if (id) {
              updateNodeData(id, {
                width: Math.round(params.width),
                height: Math.round(params.height),
              });
            }
          }}
          lineClassName="!border-primary/50"
          handleClassName="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background !rounded-sm"
        />
      )}

      {title !== undefined && (
        <div
          className={cn(
            'group/header flex flex-shrink-0 items-center gap-2 px-3 py-2.5 transition-colors',
            locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
            headerClassName
          )}
        >
          {/* Collapse toggle */}
          {onToggleCollapse && (
            <button
              className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            >
              {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          {/* Emoji or icon */}
          {emoji ? (
            <span className="flex-shrink-0 text-base">{emoji}</span>
          ) : (
            icon && <span className="flex-shrink-0 text-primary">{icon}</span>
          )}
          {onTitleChange && !locked ? (
            <input
              className="flex-1 bg-transparent text-sm font-medium tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Untitled"
            />
          ) : (
            <span className="flex-1 truncate text-sm font-medium tracking-tight text-foreground">{title}</span>
          )}
          {headerExtra}
          {id && (
            <button
              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/node:opacity-100"
              onClick={(e) => { e.stopPropagation(); setExpandedNode(id); }}
              title="Fullscreen"
            >
              <Expand className="h-3.5 w-3.5" />
            </button>
          )}
          {id && canvasMode === 'edit' && !locked && (
            <button
              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover/node:opacity-100"
              onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
              title="Delete node"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/node:opacity-100"
            onClick={(e) => { e.stopPropagation(); onMenuClick?.(e); }}
            title="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Due date badge */}
      {dueDate && !collapsed && (
        <div className={`flex items-center gap-1.5 px-3 py-1 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider ${getDueDateColor(dueDate)}`}>
          📅 {new Date(dueDate).toLocaleDateString()}
        </div>
      )}

      {nodeTags.length > 0 && !collapsed && (
        <div className="flex flex-wrap gap-1 px-2 py-1 border-b border-border/50">
          {nodeTags.map((tag) => (
            <span
              key={tag}
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TAG_COLORS[tag] || 'bg-muted text-foreground'}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {!collapsed && (
        <div className={cn('flex-1 overflow-auto nodrag nowheel nopan', bodyClassName)} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}

      {/* Footer stats & Progress */}
      {(footerStats || progress !== undefined) && !collapsed && (
        <div className="border-t-2 border-border/50 px-3 py-1 text-[10px] text-muted-foreground font-bold flex flex-col gap-1">
          {progress !== undefined && (
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/20">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className={cn("h-full", accent?.indicator || "bg-primary")}
              />
            </div>
          )}
          {footerStats && <span>{footerStats}</span>}
        </div>
      )}

      {/* Created timestamp on hover */}
      {createdAt && (
        <div className="absolute -bottom-5 left-0 text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover/node:opacity-100 whitespace-nowrap">
          Created {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </div>
      )}

      {handles && (
        <>
          {/* Target handles (incoming) */}
          <Handle type="target" position={Position.Top} id={HANDLE_IDS.TARGET.TOP} className={cn("!w-2 !h-2 !rounded-full !bg-primary/60 !border-2 !border-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover/node:opacity-100")} style={{ left: '50%', transform: 'translateX(-50%)' }} />
          <Handle type="target" position={Position.Bottom} id={HANDLE_IDS.TARGET.BOTTOM} className={cn("!w-2 !h-2 !rounded-full !bg-primary/60 !border-2 !border-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover/node:opacity-100")} style={{ left: '50%', transform: 'translateX(-50%)' }} />
          <Handle type="target" position={Position.Left} id={HANDLE_IDS.TARGET.LEFT} className={cn("!w-2 !h-2 !rounded-full !bg-primary/60 !border-2 !border-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover/node:opacity-100")} style={{ top: '50%', transform: 'translateY(-50%)' }} />
          <Handle type="target" position={Position.Right} id={HANDLE_IDS.TARGET.RIGHT} className={cn("!w-2 !h-2 !rounded-full !bg-primary/60 !border-2 !border-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover/node:opacity-100")} style={{ top: '50%', transform: 'translateY(-50%)' }} />
          {/* Source handles (outgoing) */}
          <Handle type="source" position={Position.Top} id={HANDLE_IDS.SOURCE.TOP} className={cn("!w-2 !h-2 !rounded-full !bg-primary/60 !border-2 !border-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover/node:opacity-100")} style={{ left: '50%', transform: 'translateX(-50%)' }} />
          <Handle type="source" position={Position.Bottom} id={HANDLE_IDS.SOURCE.BOTTOM} className={cn("!w-2 !h-2 !rounded-full !bg-primary/60 !border-2 !border-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover/node:opacity-100")} style={{ left: '50%', transform: 'translateX(-50%)' }} />
          <Handle type="source" position={Position.Left} id={HANDLE_IDS.SOURCE.LEFT} className={cn("!w-2 !h-2 !rounded-full !bg-primary/60 !border-2 !border-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover/node:opacity-100")} style={{ top: '50%', transform: 'translateY(-50%)' }} />
          <Handle type="source" position={Position.Right} id={HANDLE_IDS.SOURCE.RIGHT} className={cn("!w-2 !h-2 !rounded-full !bg-primary/60 !border-2 !border-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover/node:opacity-100")} style={{ top: '50%', transform: 'translateY(-50%)' }} />
        </>
      )}
    </Wrapper>
  );

  return nodeContent;
});

BaseNode.displayName = 'BaseNode';
