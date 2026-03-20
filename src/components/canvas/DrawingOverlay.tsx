import { memo } from 'react';
import { useDrawings, useViewport } from '@/store/canvasStore';

/**
 * Renders free-floating drawing strokes as SVG paths directly on the canvas.
 * Not a React Flow node — no handles, borders, or selection chrome.
 * Transforms in sync with the ReactFlow viewport via Zustand viewport state.
 */
export const DrawingOverlay = memo(function DrawingOverlay() {
  const drawings = useDrawings();
  const vp = useViewport();

  if (drawings.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    >
      <svg
        className="absolute top-0 left-0"
        width="100%"
        height="100%"
        style={{
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
          transformOrigin: '0 0',
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
