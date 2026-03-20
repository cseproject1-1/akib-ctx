import { memo } from 'react';
import { useCanvasStore } from '@/store/canvasStore';

/**
 * Renders free-floating drawing strokes as SVG paths directly on the canvas.
 * Not a React Flow node — no handles, borders, or selection chrome.
 * Rendered outside ReactFlow with a CSS transform synced to the viewport.
 *
 * viewBox is set to window size so SVG coords == CSS pixels == flow coords.
 */
export const DrawingOverlay = memo(function DrawingOverlay() {
  const drawings = useCanvasStore((s) => s.drawings);
  const vp = useCanvasStore((s) => s.viewport);

  if (drawings.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 5 }}
    >
      <svg
        className="absolute inset-0"
        width="100%"
        height="100%"
        viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
        preserveAspectRatio="none"
        style={{
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
          transformOrigin: '0 0',
          overflow: 'visible',
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
  );
});
