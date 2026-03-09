import { type NodeProps } from '@xyflow/react';
import { Square } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';

const groupColors: Record<string, { border: string; label: string }> = {
  default: { border: 'border-border', label: 'text-muted-foreground' },
  blue: { border: 'border-primary/60', label: 'text-primary' },
  green: { border: 'border-green/60', label: 'text-green' },
  red: { border: 'border-red/60', label: 'text-red' },
  purple: { border: 'border-purple/60', label: 'text-purple' },
  yellow: { border: 'border-yellow/60', label: 'text-yellow' },
  orange: { border: 'border-orange/60', label: 'text-orange' },
  cyan: { border: 'border-cyan/60', label: 'text-cyan' },
};

export function GroupNode({ id, data, selected }: NodeProps) {
  const { updateNodeData, setNodeContextMenu } = useCanvasStore();
  const nodeData = data as any;
  const colorKey = nodeData.color || 'default';
  const colors = groupColors[colorKey] || groupColors.default;

  return (
    <div
      className={`h-full w-full rounded-xl border-2 border-dashed transition-colors ${colors.border} ${
        selected ? 'shadow-[0_0_0_2px_hsl(var(--primary))]' : ''
      }`}
      style={{ backgroundColor: 'transparent', minWidth: 200, minHeight: 150 }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id });
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing">
        <Square className={`h-3.5 w-3.5 ${colors.label}`} />
        <input
          className={`bg-transparent text-xs font-bold uppercase tracking-widest outline-none ${colors.label} placeholder:text-muted-foreground`}
          value={nodeData.label || ''}
          onChange={(e) => { e.stopPropagation(); updateNodeData(id, { label: e.target.value }); }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Group Label"
        />
      </div>
    </div>
  );
}