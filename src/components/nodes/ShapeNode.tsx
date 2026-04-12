import { memo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { ShapeNodeData } from '@/types/canvas';
import { HANDLE_IDS } from '@/lib/constants/canvas';

const shapeColors: Record<string, string> = {
  default: 'hsl(0 0% 25%)',
  blue: 'hsl(217, 91%, 60%)',
  green: 'hsl(142, 76%, 46%)',
  red: 'hsl(0, 84%, 60%)',
  purple: 'hsl(262, 83%, 58%)',
  yellow: 'hsl(52, 100%, 50%)',
  orange: 'hsl(25, 95%, 53%)',
  cyan: 'hsl(188, 85%, 50%)',
};

function ShapeSVG({ shapeType, color, w, h }: { shapeType: string; color: string; w: number; h: number }) {
  const fill = shapeColors[color] || shapeColors.default;
  const fillOpacity = '0.15';
  const stroke = fill;

  switch (shapeType) {
    case 'circle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 4} ry={h / 2 - 4} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={2.5} />
        </svg>
      );
    case 'diamond':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polygon points={`${w / 2},4 ${w - 4},${h / 2} ${w / 2},${h - 4} 4,${h / 2}`} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={2.5} />
        </svg>
      );
    case 'triangle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polygon points={`${w / 2},4 ${w - 4},${h - 4} 4,${h - 4}`} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={2.5} />
        </svg>
      );
    default: // rect
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={3} y={3} width={w - 6} height={h - 6} rx={4} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={2.5} />
        </svg>
      );
  }
}

export const ShapeNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const nodeData = data as unknown as ShapeNodeData;
  const [editing, setEditing] = useState(false);
  const [labelValue, setLabelValue] = useState(nodeData.label || '');
  const w = nodeData.width || 160;
  const h = nodeData.height || 120;

  // Sync label when not editing
  useEffect(() => {
    if (!editing) setLabelValue(nodeData.label || '');
  }, [editing, nodeData.label]);

  const handleLabelChange = useCallback(() => {
    setEditing(false);
    updateNodeData(id, { label: labelValue });
  }, [id, updateNodeData, labelValue]);

  return (
    <div className="relative" style={{ width: w, height: h }}>
      <ShapeSVG shapeType={nodeData.shapeType || 'rect'} color={nodeData.color || 'default'} w={w} h={h} />
      <div className="absolute inset-0 flex items-center justify-center">
        {editing ? (
          <input
            className="bg-transparent text-center text-sm font-bold text-foreground outline-none w-[80%]"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={handleLabelChange}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            autoFocus
          />
        ) : (
          <span
            className="text-sm font-bold text-foreground cursor-default"
            onDoubleClick={() => !nodeData.locked && setEditing(true)}
          >
            {nodeData.label || ''}
          </span>
        )}
      </div>
      {selected && (
        <div className="absolute -top-0.5 -left-0.5 -right-0.5 -bottom-0.5 border-2 border-primary rounded pointer-events-none" />
      )}
      <Handle type="target" position={Position.Top} id={HANDLE_IDS.TARGET.TOP} className="perimeter-handle !-top-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Top} id={HANDLE_IDS.SOURCE.TOP} className="perimeter-handle !-top-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="target" position={Position.Bottom} id={HANDLE_IDS.TARGET.BOTTOM} className="perimeter-handle !-bottom-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Bottom} id={HANDLE_IDS.SOURCE.BOTTOM} className="perimeter-handle !-bottom-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="target" position={Position.Left} id={HANDLE_IDS.TARGET.LEFT} className="perimeter-handle !-left-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Left} id={HANDLE_IDS.SOURCE.LEFT} className="perimeter-handle !-left-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <Handle type="target" position={Position.Right} id={HANDLE_IDS.TARGET.RIGHT} className="perimeter-handle !-right-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Right} id={HANDLE_IDS.SOURCE.RIGHT} className="perimeter-handle !-right-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <div className="anchor-dot top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="anchor-dot bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" />
      <div className="anchor-dot left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="anchor-dot right-0 top-1/2 translate-x-1/2 -translate-y-1/2" />
      {!nodeData.locked && (
        <NodeResizer
          isVisible={selected}
          minWidth={80}
          minHeight={60}
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

ShapeNode.displayName = 'ShapeNode';
