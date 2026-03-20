import { useCallback, useRef, useState, forwardRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Undo2, Trash2, Eraser, Pencil, Highlighter, Minus, Circle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const PRESET_COLORS = [
  'hsl(0, 0%, 100%)',
  'hsl(0, 0%, 15%)',
  'hsl(0, 85%, 55%)',
  'hsl(30, 95%, 55%)',
  'hsl(52, 100%, 50%)',
  'hsl(140, 70%, 45%)',
  'hsl(210, 90%, 55%)',
  'hsl(280, 75%, 55%)',
];

const WIDTH_PRESETS = [
  { label: 'Thin', value: 2, icon: <Minus className="h-3 w-3" /> },
  { label: 'Medium', value: 4, icon: <Minus className="h-4 w-4 stroke-[3]" /> },
  { label: 'Thick', value: 8, icon: <Minus className="h-5 w-5 stroke-[4]" /> },
];

const ERASER_SIZES = [
  { label: 'Small', value: 16 },
  { label: 'Medium', value: 32 },
  { label: 'Large', value: 64 },
];

type DrawingTool = 'pen' | 'highlighter' | 'eraser';

interface PathData {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  opacity: number;
}

interface DrawingLayerProps {
  active: boolean;
  onFinish: () => void;
}

// Convert points to smooth bezier path
function pointsToSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Control point for smooth curve
    const cpX = curr.x;
    const cpY = curr.y;
    
    // End point is midpoint to next
    const endX = (curr.x + next.x) / 2;
    const endY = (curr.y + next.y) / 2;
    
    path += ` Q ${cpX} ${cpY} ${endX} ${endY}`;
  }
  
  // Final line to last point
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  
  return path;
}

// Check if point is near a path
function isPointNearPath(
  point: { x: number; y: number },
  pathPoints: { x: number; y: number }[],
  threshold: number
): boolean {
  for (const p of pathPoints) {
    const dist = Math.sqrt(Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2));
    if (dist < threshold) return true;
  }
  return false;
}

export const DrawingLayer = forwardRef<HTMLDivElement, DrawingLayerProps>(function DrawingLayer({ active, onFinish }, ref) {
  const [drawing, setDrawing] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [paths, setPaths] = useState<PathData[]>([]);
  const [color, setColor] = useState('hsl(52, 100%, 50%)');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [eraserSize, setEraserSize] = useState(32);
  const [opacity, setOpacity] = useState([1]);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const getPoint = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const effectiveWidth = tool === 'highlighter' ? Math.max(strokeWidth * 4, 16) : strokeWidth;
  const effectiveOpacity = tool === 'highlighter' ? 0.35 : opacity[0];

  const eraseAtPoint = useCallback((pt: { x: number; y: number }) => {
    setPaths((prev) => prev.filter((p) => !isPointNearPath(pt, p.points, eraserSize / 2)));
  }, [eraserSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!active) return;
    const pt = getPoint(e);

    if (tool === 'eraser') {
      setErasing(true);
      eraseAtPoint(pt);
      return;
    }

    setDrawing(true);
    setCurrentPoints([pt]);
  }, [active, getPoint, tool, eraseAtPoint]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pt = getPoint(e);
    
    if (tool === 'eraser' && active) {
      setEraserPos(pt);
      if (erasing) {
        eraseAtPoint(pt);
      }
      return;
    }
    
    if (!drawing) return;
    setCurrentPoints((prev) => [...prev, pt]);
  }, [drawing, erasing, getPoint, tool, active, eraseAtPoint]);

  const handleMouseUp = useCallback(() => {
    if (erasing) {
      setErasing(false);
      return;
    }
    
    if (!drawing) return;
    setDrawing(false);
    if (currentPoints.length > 0) {
      setPaths((prev) => [...prev, {
        points: currentPoints,
        color,
        width: effectiveWidth,
        opacity: effectiveOpacity
      }]);
      setCurrentPoints([]);
    }
  }, [drawing, erasing, currentPoints, color, effectiveWidth, effectiveOpacity]);

  const handleMouseLeave = useCallback(() => {
    setEraserPos(null);
    handleMouseUp();
  }, [handleMouseUp]);

  const handleUndoStroke = useCallback(() => {
    setPaths((prev) => prev.slice(0, -1));
  }, []);

  const handleClearAll = useCallback(() => {
    setPaths([]);
    setCurrentPoints([]);
  }, []);

  const handleSave = useCallback(() => {
    if (paths.length === 0) {
      onFinish();
      return;
    }

    // Convert each path's points from screen coords to flow coords
    const overlayPaths = paths.map(p => {
      const flowPoints = p.points.map(pt => screenToFlowPosition({ x: pt.x, y: pt.y }));
      return {
        d: pointsToSmoothPath(flowPoints),
        color: p.color,
        width: p.width,
        opacity: p.opacity,
      };
    });

    const { addDrawing } = useCanvasStore.getState();
    addDrawing({
      id: crypto.randomUUID(),
      paths: overlayPaths,
    });

    setPaths([]);
    setCurrentPoints([]);
    onFinish();
  }, [paths, screenToFlowPosition, onFinish]);

  if (!active && paths.length === 0) return null;

  return (
    <div 
      ref={ref} 
      className="fixed inset-0 z-[65]" 
      style={{ cursor: active ? (tool === 'eraser' ? 'none' : 'crosshair') : 'default' }}
    >
      <svg
        ref={svgRef}
        className="h-full w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Rendered paths */}
        {paths.map((p, i) => (
          <path
            key={i}
            d={pointsToSmoothPath(p.points)}
            stroke={p.color}
            strokeWidth={p.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={p.opacity}
          />
        ))}
        
        {/* Current drawing path */}
        {currentPoints.length > 0 && (
          <path
            d={pointsToSmoothPath(currentPoints)}
            stroke={color}
            strokeWidth={effectiveWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={effectiveOpacity}
          />
        )}
        
        {/* Eraser cursor */}
        {tool === 'eraser' && eraserPos && active && (
          <g>
            <circle
              cx={eraserPos.x}
              cy={eraserPos.y}
              r={eraserSize / 2}
              fill="hsl(var(--background) / 0.5)"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
            <circle
              cx={eraserPos.x}
              cy={eraserPos.y}
              r={2}
              fill="hsl(var(--foreground))"
            />
          </g>
        )}
      </svg>

      {/* Enhanced Drawing Toolbar */}
      {active && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2 shadow-[4px_4px_0px_hsl(var(--shadow-color,0_0%_15%))]">
          {/* Tool selection */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <button
              onClick={() => setTool('pen')}
              className={`rounded-md p-1.5 transition-colors ${tool === 'pen' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Pencil (smooth drawing)"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTool('highlighter')}
              className={`rounded-md p-1.5 transition-colors ${tool === 'highlighter' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Highlighter"
            >
              <Highlighter className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`rounded-md p-1.5 transition-colors ${tool === 'eraser' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Eraser (drag to erase)"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-6 w-px bg-border" />

          {tool === 'eraser' ? (
            /* Eraser size control */
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Size</span>
              <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
                {ERASER_SIZES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setEraserSize(s.value)}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${eraserSize === s.value ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    title={s.label}
                  >
                    {s.label[0]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Color presets */}
              <div className="flex items-center gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-5 w-5 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-primary' : 'border-transparent hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <label className="relative ml-1 cursor-pointer" title="Custom color">
                  <Circle className="h-5 w-5 text-muted-foreground" style={{ fill: color, stroke: 'hsl(var(--border))' }} />
                  <input
                    type="color"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(e) => setColor(e.target.value)}
                  />
                </label>
              </div>

              <div className="h-6 w-px bg-border" />

              {/* Width presets */}
              <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
                {WIDTH_PRESETS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setStrokeWidth(w.value)}
                    className={`rounded-md p-1.5 transition-colors ${strokeWidth === w.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    title={w.label}
                  >
                    {w.icon}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-border" />

              {/* Opacity slider */}
              {tool !== 'highlighter' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Op</span>
                  <Slider
                    value={opacity}
                    onValueChange={setOpacity}
                    min={0.2}
                    max={1}
                    step={0.1}
                    className="w-16"
                  />
                  <span className="w-6 text-[10px] font-bold text-muted-foreground">{Math.round(opacity[0] * 100)}%</span>
                </div>
              )}
            </>
          )}

          <div className="h-6 w-px bg-border" />

          {/* Undo & Clear */}
          <button
            onClick={handleUndoStroke}
            disabled={paths.length === 0}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            title="Undo last stroke"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClearAll}
            disabled={paths.length === 0}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
            title="Clear all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <div className="h-6 w-px bg-border" />

          {/* Done / Cancel */}
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold uppercase text-primary-foreground"
          >
            Done ({paths.length})
          </button>
          <button
            onClick={() => { setPaths([]); setCurrentPoints([]); onFinish(); }}
            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold uppercase text-destructive-foreground"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
});

DrawingLayer.displayName = 'DrawingLayer';
