import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { useStore } from '@xyflow/react';
import type { DrawingOverlay as DrawingOverlayType } from '@/types/canvas';

/**
 * @component DrawingOverlay
 * @description Renders free-floating drawing strokes on the canvas.
 *
 * ─ Interactive features:
 *   • Each drawing is individually selectable by clicking it
 *   • Selected drawing shows a bounding-box highlight + Delete / Move badge
 *   • Delete key removes the selected drawing
 *   • Right-click opens a small context menu (Delete)
 *   • Escape deselects
 *   • Clicking the canvas deselects
 *   • Dragging the bounding box moves the drawing
 *   • Dragging corners resizes the drawing
 *
 * ─ Coordinate model: paths are stored in React Flow's flow-space coordinates.
 *   The SVG is transformed via the viewport (pan + zoom) just like the canvas.
 */
export const DrawingOverlay = memo(function DrawingOverlay() {
  const drawings      = useCanvasStore((s) => s.drawings);
  const drawingMode   = useCanvasStore((s) => s.drawingMode);
  const deleteDrawing = useCanvasStore((s) => s.deleteDrawing);
  const updateDrawing = useCanvasStore((s) => s.updateDrawing);
  // Sync with ReactFlow internal store for lag-free transformation and dimensions
  const [vx, vy, vz] = useStore((s) => s.transform);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const viewport = useMemo(() => ({ x: vx, y: vy, zoom: vz }), [vx, vy, vz]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const viewBox = useMemo(() => `0 0 ${width} ${height}`, [width, height]);


  // ── Deselect on Escape / Delete key ─────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedId(null); setContextMenu(null); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const tag = (document.activeElement as HTMLElement)?.tagName ?? '';
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (document.activeElement as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        deleteDrawing(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, deleteDrawing]);

  // ── Click outside overlay → deselect ────────────────────────────────────────
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      // If clicking outside the hit-targets, deselect
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        if (!e.defaultPrevented) {
          setSelectedId(null);
          setContextMenu(null);
        }
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    setContextMenu({ x: e.clientX, y: e.clientY, id });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  if (drawings.length === 0) return null;

  const isInteractive = !drawingMode;

  return (
    <>
      {/* Main SVG overlay (Static rendering layer) */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: isInteractive ? 45 : 44, // Using drawing z-index baseline
          pointerEvents: 'none',
        }}
      >
        <svg
          className="absolute inset-0"
          width="100%"
          height="100%"
          viewBox={viewBox}
          preserveAspectRatio="none"
          style={{
            transform: `translate(${vx}px, ${vy}px) scale(${vz})`,
            transformOrigin: '0 0',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          {drawings.map((drawing) =>
            drawing.paths.map((path, j) => (
              <path
                key={`${drawing.id}-${j}`}
                d={path.d}
                stroke={path.color}
                strokeWidth={path.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={path.opacity ?? 1}
              />
            ))
          )}
        </svg>
      </div>

      {/* Interactive hit areas, bounding boxes, and resize handles */}
      {isInteractive && (
        <div
          ref={overlayRef}
          className="absolute inset-0"
          style={{ zIndex: 48, pointerEvents: 'none' }} // Using drawing-interactive z-index
        >
          <svg
            className="absolute inset-0"
            width="100%"
            height="100%"
            viewBox={viewBox}
            preserveAspectRatio="none"
            style={{
              transform: `translate(${vx}px, ${vy}px) scale(${vz})`,
              transformOrigin: '0 0',
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            {drawings.map((drawing) => (
              <DrawingHitTarget
                key={drawing.id}
                drawing={drawing}
                isSelected={drawing.id === selectedId}
                onSelect={() => setSelectedId(drawing.id)}
                onContextMenu={(e) => handleContextMenu(e, drawing.id)}
                onDelete={() => { deleteDrawing(drawing.id); setSelectedId(null); }}
                onUpdate={(updates) => updateDrawing(drawing.id, updates)}
                viewport={viewport}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <DrawingContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => {
            deleteDrawing(contextMenu.id);
            setSelectedId(null);
            closeContextMenu();
          }}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
});

// ── DrawingHitTarget ──────────────────────────────────────────────────────────

interface HitTargetProps {
  drawing: DrawingOverlayType;
  isSelected: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<DrawingOverlayType>) => void;
  viewport: { x: number; y: number; zoom: number };
}

const HANDLE_SIZE = 8;

const DrawingHitTarget = memo(function DrawingHitTarget({
  drawing, isSelected, onSelect, onContextMenu, onDelete, onUpdate, viewport
}: HitTargetProps) {
  const [hovered, setHovered] = useState(false);
  const bbox = getBoundingBox(drawing);

  // ── Drag & Resize state (Flow coordinates) ──────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  
  // Stored for during-drag continuous translation mapping
  const activeTransformRef = useRef<{ 
    initialPaths: typeof drawing.paths;
    initialBbox: BBox;
    startX: number;
    startY: number;
  } | null>(null);

  const activeColor = 
    isDragging || isResizing ? 'hsl(var(--primary))' :
    isSelected ? 'hsl(var(--primary))' :
    hovered ? 'hsl(var(--primary) / 0.4)' :
    'transparent';

  // Screen to flow helpers
  const toFlowX = useCallback((clientX: number) => (clientX - viewport.x) / viewport.zoom, [viewport]);
  const toFlowY = useCallback((clientY: number) => (clientY - viewport.y) / viewport.zoom, [viewport]);

  // ── Pointer Handlers ────────────────────────────────────────────────────────

  const onPointerDownBody = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    if (e.button !== 0) return; // only left click
    
    if (!bbox) return;

    setIsDragging(true);
    activeTransformRef.current = {
      initialPaths: drawing.paths.map(p => ({ ...p })), // clone
      initialBbox: { ...bbox },
      startX: toFlowX(e.clientX),
      startY: toFlowY(e.clientY),
    };
  };

  const onPointerDownHandle = (e: React.PointerEvent, handlePos: string) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    if (e.button !== 0 || !bbox) return;

    setIsResizing(handlePos);
    activeTransformRef.current = {
      initialPaths: drawing.paths.map(p => ({ ...p })),
      initialBbox: { ...bbox },
      startX: toFlowX(e.clientX),
      startY: toFlowY(e.clientY),
    };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const onPointerMove = (e: PointerEvent) => {
      const state = activeTransformRef.current;
      if (!state) return;

      const currentX = toFlowX(e.clientX);
      const currentY = toFlowY(e.clientY);
      const dx = currentX - state.startX;
      const dy = currentY - state.startY;

      if (isDragging) {
        // Fast Translation logic
        const newPaths = state.initialPaths.map(p => ({
          ...p,
          d: translatePath(p.d, dx, dy)
        }));
        onUpdate({ paths: newPaths });
      } else if (isResizing && isResizing.length === 2 && state.initialBbox) {
        // Fast Resizing logic 
        const { x: boxX, y: boxY, width: boxW, height: boxH } = state.initialBbox;
        
        // Calculate new bounds based on which handle is dragged
        let newX = boxX;
        let newY = boxY;
        let newW = boxW;
        let newH = boxH;

        if (isResizing.includes('w')) {
          newX = boxX + dx;
          newW = boxW - dx;
        } else if (isResizing.includes('e')) {
          newW = boxW + dx;
        }

        if (isResizing.includes('n')) {
          newY = boxY + dy;
          newH = boxH - dy;
        } else if (isResizing.includes('s')) {
          newH = boxH + dy;
        }

        // Prevent negative scale/inversion wrapper
        if (newW < 20) { newW = 20; if (isResizing.includes('w')) newX = boxX + boxW - 20; }
        if (newH < 20) { newH = 20; if (isResizing.includes('n')) newY = boxY + boxH - 20; }

        const scaleX = newW / boxW;
        const scaleY = newH / boxH;

        const newPaths = state.initialPaths.map(p => ({
          ...p,
          d: scaleAndTranslatePath(p.d, scaleX, scaleY, boxX, boxY, newX, newY),
          width: Math.max(1, p.width * Math.max(scaleX, scaleY)) // approximate stroke width scaling
        }));
        onUpdate({ paths: newPaths });
      }
    };

    const onPointerUp = () => {
      setIsDragging(false);
      setIsResizing(null);
      activeTransformRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging, isResizing, toFlowX, toFlowY, onUpdate]);

  return (
    <g
      style={{ pointerEvents: 'none' }}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible wide hit-area over each path */}
      <g 
        style={{ pointerEvents: 'all', cursor: isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDownBody}
      >
        {drawing.paths.map((path, j) => (
          <path
            key={j}
            d={path.d}
            stroke="transparent"
            strokeWidth={Math.max(path.width * 2, 20)}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* Bounding box highlight (flow-space) */}
      {(isSelected || hovered) && bbox && (
        <>
          <rect
            x={bbox.x - 6}
            y={bbox.y - 6}
            width={bbox.width + 12}
            height={bbox.height + 12}
            rx={4}
            fill="none"
            stroke={activeColor}
            strokeWidth={isSelected ? 2 : 1}
            strokeDasharray={isSelected && !isDragging && !isResizing ? undefined : '6 3'}
          />
          
          {/* Resize Handles */}
          {isSelected && !isDragging && (
            <>
              {/* NW */}
              <circle cx={bbox.x - 6} cy={bbox.y - 6} r={HANDLE_SIZE} fill="#fff" stroke={activeColor} strokeWidth={2} style={{ pointerEvents: 'all', cursor: 'nwse-resize' }} onPointerDown={(e) => onPointerDownHandle(e, 'nw')} />
              {/* NE */}
              <circle cx={bbox.x + bbox.width + 6} cy={bbox.y - 6} r={HANDLE_SIZE} fill="#fff" stroke={activeColor} strokeWidth={2} style={{ pointerEvents: 'all', cursor: 'nesw-resize' }} onPointerDown={(e) => onPointerDownHandle(e, 'ne')} />
              {/* SW */}
              <circle cx={bbox.x - 6} cy={bbox.y + bbox.height + 6} r={HANDLE_SIZE} fill="#fff" stroke={activeColor} strokeWidth={2} style={{ pointerEvents: 'all', cursor: 'nesw-resize' }} onPointerDown={(e) => onPointerDownHandle(e, 'sw')} />
              {/* SE */}
              <circle cx={bbox.x + bbox.width + 6} cy={bbox.y + bbox.height + 6} r={HANDLE_SIZE} fill="#fff" stroke={activeColor} strokeWidth={2} style={{ pointerEvents: 'all', cursor: 'nwse-resize' }} onPointerDown={(e) => onPointerDownHandle(e, 'se')} />
            </>
          )}

          {/* Delete button (top right, slightly offset) */}
          {isSelected && !isDragging && !isResizing && (
            <g
              transform={`translate(${bbox.x + bbox.width + 6 + 18} ${bbox.y - 6 - 8})`}
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <circle r={10} fill="hsl(var(--destructive))" />
              <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={14} fontWeight="bold" style={{ userSelect: 'none', pointerEvents: 'none' }}>×</text>
            </g>
          )}
        </>
      )}
    </g>
  );
});

// ── Context menu ──────────────────────────────────────────────────────────────

interface ContextMenuProps { x: number; y: number; onDelete: () => void; onClose: () => void; }

function DrawingContextMenu({ x, y, onDelete, onClose }: ContextMenuProps) {
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed z-context-menu min-w-[140px] rounded-xl border border-border bg-card shadow-xl py-1"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button onClick={onDelete} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors">
        <Trash2 className="h-3.5 w-3.5" /> Delete Drawing
      </button>
      <div className="px-3 py-1 text-[10px] text-muted-foreground border-t border-border mt-1">
        or press <kbd className="rounded bg-muted px-1">Del</kbd>
      </div>
    </div>
  );
}

// ── SVG Math Helpers ─────────────────────────────────────────────────────────

interface BBox { x: number; y: number; width: number; height: number }

function getBoundingBox(drawing: DrawingOverlayType): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of drawing.paths) {
    const nums = path.d.match(/-?\d+(\.\d+)?/g);
    if (!nums) continue;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const px = parseFloat(nums[i]);
      const py = parseFloat(nums[i + 1]);
      if (isNaN(px) || isNaN(py)) continue;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
  }
  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Translates an SVG path data string by dx, dy */
function translatePath(d: string, dx: number, dy: number): string {
  // Matches the command char or the numeric coordinates
  return d.replace(/([MLQCZ])|(-?\d+(?:\.\d+)?)/gi, (match, cmd, num, offset, str) => {
    if (cmd) return cmd; // preserve commands
    
    // Quick heuristic to determine if value is X or Y
    // Find the preceding command character position to determine parity
    let cmdPos = -1;
    for (let i = offset; i >= 0; i--) {
      if (/[MLQCZ]/i.test(str[i])) { cmdPos = i; break; }
    }
    
    // Count how many numbers appear between the command and this number
    const substr = str.slice(cmdPos + 1, offset);
    const numCount = (substr.match(/-?\d+(?:\.\d+)?/g) || []).length;
    
    // Even index means X, Odd index means Y (for M, L, Q pairs)
    const val = parseFloat(match);
    return ((numCount % 2 === 0) ? (val + dx) : (val + dy)).toFixed(2);
  });
}

/** Scales and translates an SVG path relative to an origin point */
function scaleAndTranslatePath(d: string, scaleX: number, scaleY: number, oldX: number, oldY: number, newX: number, newY: number): string {
  return d.replace(/([MLQCZ])|(-?\d+(?:\.\d+)?)/gi, (match, cmd, _, offset, str) => {
    if (cmd) return cmd; 
    
    let cmdPos = -1;
    for (let i = offset; i >= 0; i--) {
      if (/[MLQCZ]/i.test(str[i])) { cmdPos = i; break; }
    }
    
    const substr = str.slice(cmdPos + 1, offset);
    const numCount = (substr.match(/-?\d+(?:\.\d+)?/g) || []).length;
    
    const val = parseFloat(match);
    if (numCount % 2 === 0) {
      // It's an X coordinate
      return (((val - oldX) * scaleX) + newX).toFixed(2);
    } else {
      // It's a Y coordinate
      return (((val - oldY) * scaleY) + newY).toFixed(2);
    }
  });
}
