import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { StickyNote } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';

const colorMap: Record<string, { bg: string; border: string; bullet: string }> = {
  yellow: { bg: 'bg-yellow/10', border: 'border-yellow/30', bullet: 'bg-yellow' },
  green: { bg: 'bg-green/10', border: 'border-green/30', bullet: 'bg-green' },
  red: { bg: 'bg-red/10', border: 'border-red/30', bullet: 'bg-red' },
  purple: { bg: 'bg-purple/10', border: 'border-purple/30', bullet: 'bg-purple' },
  orange: { bg: 'bg-orange/10', border: 'border-orange/30', bullet: 'bg-orange' },
  cyan: { bg: 'bg-cyan/10', border: 'border-cyan/30', bullet: 'bg-cyan' },
  default: { bg: '', border: 'border-border', bullet: 'bg-muted-foreground' },
};

export function SummaryNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as any;
  const color = colorMap[nodeData.color || 'yellow'] || colorMap.yellow;

  const handleBulletChange = (index: number, value: string) => {
    const bullets = [...(nodeData.bullets || [''])];
    bullets[index] = value;
    updateNodeData(id, { bullets });
  };

  const handleBulletKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const bullets = [...(nodeData.bullets || [''])];
    if (e.key === 'Enter') {
      e.preventDefault();
      bullets.splice(index + 1, 0, '');
      updateNodeData(id, { bullets });
      setTimeout(() => {
        const inputs = (e.currentTarget as HTMLElement)
          .closest('.summary-bullets')
          ?.querySelectorAll('input');
        (inputs?.[index + 1] as HTMLInputElement)?.focus();
      }, 0);
    }
    if (e.key === 'Backspace' && bullets[index] === '' && bullets.length > 1) {
      e.preventDefault();
      bullets.splice(index, 1);
      updateNodeData(id, { bullets });
    }
  };

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Summary'}
      icon={<StickyNote className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(v) => updateNodeData(id, { title: v })}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={(data as any)?.tags}
      color={(data as any).color}
      className={color.bg}
    >
      <div className="summary-bullets space-y-1.5 p-3">
        {(nodeData.bullets || ['']).map((bullet: string, i: number) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full ${color.bullet}`} />
            <input
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              value={bullet}
              onChange={(e) => handleBulletChange(i, e.target.value)}
              onKeyDown={(e) => handleBulletKeyDown(i, e)}
              onClick={(e) => e.stopPropagation()}
              readOnly={!selected}
            />
          </div>
        ))}
      </div>
    </BaseNode>
  );
}
