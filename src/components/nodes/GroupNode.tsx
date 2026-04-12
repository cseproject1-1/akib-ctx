import { memo } from 'react';
import { type NodeProps, NodeResizer } from '@xyflow/react';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { GroupNodeData } from '@/types/canvas';

const groupColors: Record<string, { border: string; label: string; bg: string }> = {
  default: { border: 'border-border', label: 'text-muted-foreground', bg: 'bg-muted/5' },
  blue: { border: 'border-primary/60', label: 'text-primary', bg: 'bg-primary/5' },
  green: { border: 'border-green/60', label: 'text-green', bg: 'bg-green/5' },
  red: { border: 'border-red/60', label: 'text-red', bg: 'bg-red/5' },
  purple: { border: 'border-purple/60', label: 'text-purple', bg: 'bg-purple/5' },
  yellow: { border: 'border-yellow/60', label: 'text-yellow', bg: 'bg-yellow/5' },
  orange: { border: 'border-orange/60', label: 'text-orange', bg: 'bg-orange/5' },
  cyan: { border: 'border-cyan/60', label: 'text-cyan', bg: 'bg-cyan/5' },
};

export const GroupNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const toggleGroupCollapse = useCanvasStore((s) => s.toggleGroupCollapse);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const nodeData = data as unknown as GroupNodeData;
  const isCollapsed = nodeData.collapsed;
  const colorKey = nodeData.color || 'default';
  const colors = groupColors[colorKey] || groupColors.default;
  const w = nodeData.width || 200;
  const h = nodeData.height || (isCollapsed ? 48 : 150);

  return (
    <div
      className={`h-full w-full rounded-xl border-2 transition-all relative ${
        isCollapsed ? 'border-solid shadow-sm' : 'border-dashed'
      } ${colors.border} ${colors.bg} ${
        selected ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
      style={{ width: w, height: h }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id });
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing h-12">
        <div className="flex items-center gap-2 overflow-hidden">
          <button 
            onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(id); }}
            className="p-0.5 hover:bg-black/10 rounded transition-colors"
          >
            {isCollapsed ? 
              <ChevronRight className={`h-4 w-4 ${colors.label}`} /> : 
              <ChevronDown className={`h-4 w-4 ${colors.label}`} />
            }
          </button>
          {isCollapsed ? 
            <Folder className={`h-4 w-4 ${colors.label} shrink-0`} /> : 
            <FolderOpen className={`h-4 w-4 ${colors.label} shrink-0`} />
          }
          <input
            className={`bg-transparent text-xs font-bold uppercase tracking-widest outline-none truncate ${colors.label} placeholder:text-muted-foreground/50`}
            value={nodeData.label || ''}
            onChange={(e) => { e.stopPropagation(); updateNodeData(id, { label: e.target.value }); }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="New Group"
          />
        </div>
        {isCollapsed && (
          <div className="text-[9px] font-bold text-muted-foreground/50 uppercase px-1.5 py-0.5 border border-border rounded bg-card">
            Collapsed
          </div>
        )}
      </div>
      {!nodeData.locked && canvasMode === 'edit' && selected && (
        <NodeResizer
          minWidth={100}
          minHeight={48}
          onResizeEnd={(_event, params) => {
            updateNodeData(id, {
              width: Math.round(params.width),
              height: Math.round(params.height),
            });
          }}
          lineClassName="!border-primary/30"
          handleClassName="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background !rounded-full"
        />
      )}
    </div>
  );
});

GroupNode.displayName = 'GroupNode';