import { memo, forwardRef } from 'react';
import { type NodeProps } from '@xyflow/react';
import { HelpCircle } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/store/canvasStore';

const colorMap: Record<string, { bg: string; num: string; text: string }> = {
  yellow: { bg: '!bg-yellow/90 !border-yellow/70', num: 'text-yellow-foreground/50', text: 'text-yellow-foreground' },
  green: { bg: '!bg-green/20 !border-green/40', num: 'text-green/60', text: 'text-foreground' },
  red: { bg: '!bg-red/20 !border-red/40', num: 'text-red/60', text: 'text-foreground' },
  purple: { bg: '!bg-purple/20 !border-purple/40', num: 'text-purple/60', text: 'text-foreground' },
  cyan: { bg: '!bg-cyan/20 !border-cyan/40', num: 'text-cyan/60', text: 'text-foreground' },
  default: { bg: '', num: 'text-muted-foreground', text: 'text-foreground' },
};

export const TermQuestionNode = memo(forwardRef<HTMLDivElement, NodeProps>(({ id, data, selected }, ref) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as { year: string; questions: string[]; color?: string };
  const colors = colorMap[nodeData.color || 'yellow'] || colorMap.yellow;

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...(nodeData.questions || [''])];
    newQuestions[index] = value;
    updateNodeData(id, { questions: newQuestions });
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const newQuestions = [...(nodeData.questions || [''])];
      newQuestions.splice(index + 1, 0, '');
      updateNodeData(id, { questions: newQuestions });
    }
    if (e.key === 'Backspace' && nodeData.questions[index] === '' && nodeData.questions.length > 1) {
      e.preventDefault();
      const newQuestions = nodeData.questions.filter((_, i) => i !== index);
      updateNodeData(id, { questions: newQuestions });
    }
  };

  return (
    <div ref={ref}>
    <BaseNode
      id={id}
      title={undefined}
      selected={selected}
      className={colors.bg}
      bodyClassName="p-4"
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={(data as any)?.tags}
    >
      <div className="mb-3">
        <input
          className={`w-full bg-transparent text-2xl font-bold outline-none placeholder:opacity-40 ${colors.text}`}
          value={nodeData.year || ''}
          onChange={(e) => updateNodeData(id, { year: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Title / Year…"
        />
      </div>
      <ul className="space-y-2">
        {(nodeData.questions || ['']).map((q: string, i: number) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-1 text-xs font-mono ${colors.num}`}>{i + 1}.</span>
            <input
              className={`flex-1 bg-transparent text-sm outline-none placeholder:opacity-40 ${colors.text}`}
              value={q}
              onChange={(e) => handleQuestionChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Type a question…"
            />
          </li>
        ))}
      </ul>
    </BaseNode>
    </div>
  );
}));

TermQuestionNode.displayName = 'TermQuestionNode';
