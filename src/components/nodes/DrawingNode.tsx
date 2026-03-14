import { memo, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { DrawingNodeData } from '@/types/canvas';

interface PathData {
  d: string;
  color: string;
  width: number;
  opacity?: number;
}

export const DrawingNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as DrawingNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  
  // Current dimensions (can be resized)
  const w = nodeData.width || 400;
  const h = nodeData.height || 300;
  
  // Original dimensions (for scaling paths)
  const origW = nodeData.originalWidth ?? w;
  const origH = nodeData.originalHeight ?? h;
  
  // Initialize original dimensions if missing (healing legacy nodes)
  useEffect(() => {
    if (nodeData.originalWidth === undefined || nodeData.originalHeight === undefined) {
      updateNodeData(id, {
        originalWidth: nodeData.originalWidth ?? w,
        originalHeight: nodeData.originalHeight ?? h,
      });
    }
  }, [id, nodeData.originalWidth, nodeData.originalHeight, w, h, updateNodeData]);

  // Calculate scale factors
  const scaleX = w / origW;
  const scaleY = h / origH;
  
  // Handle resize end to update stored dimensions
  const handleResizeEnd = useCallback((_event: unknown, params: { width: number; height: number }) => {
    updateNodeData(id, {
      width: Math.round(params.width),
      height: Math.round(params.height),
    });
  }, [id, updateNodeData]);

  return (
    <div className="group/drawing relative" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={selected}
        minWidth={50}
        minHeight={40}
        onResizeEnd={handleResizeEnd}
        lineClassName="!border-primary"
        handleClassName="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background !rounded-sm"
      />
      
      <svg 
        width={w} 
        height={h} 
        viewBox={`0 0 ${origW} ${origH}`}
        preserveAspectRatio="none"
        className="rounded-lg" 
        style={{ background: 'transparent' }}
      >
        {((nodeData.paths as unknown as PathData[]) || []).map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.color}
            strokeWidth={p.width / Math.max(scaleX, scaleY)}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={p.opacity ?? 1}
          />
        ))}
      </svg>
      
      {/* Selection outline */}
      {selected && (
        <div className="pointer-events-none absolute -inset-0.5 rounded border-2 border-primary" />
      )}
      
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} id="t-top" className="!-top-1.5 !h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground opacity-0 transition-opacity group-hover/drawing:opacity-100" />
      <Handle type="source" position={Position.Top} id="s-top" className="!-top-1.5 !h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground opacity-0 transition-opacity group-hover/drawing:opacity-100" />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className="!-bottom-1.5 !h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground opacity-0 transition-opacity group-hover/drawing:opacity-100" />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className="!-bottom-1.5 !h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground opacity-0 transition-opacity group-hover/drawing:opacity-100" />
      <Handle type="target" position={Position.Left} id="t-left" className="!-left-1.5 !h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground opacity-0 transition-opacity group-hover/drawing:opacity-100" />
      <Handle type="source" position={Position.Left} id="s-left" className="!-left-1.5 !h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground opacity-0 transition-opacity group-hover/drawing:opacity-100" />
      <Handle type="target" position={Position.Right} id="t-right" className="!-right-1.5 !h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground opacity-0 transition-opacity group-hover/drawing:opacity-100" />
      <Handle type="source" position={Position.Right} id="s-right" className="!-right-1.5 !h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground opacity-0 transition-opacity group-hover/drawing:opacity-100" />
    </div>
  );
});

DrawingNode.displayName = 'DrawingNode';
