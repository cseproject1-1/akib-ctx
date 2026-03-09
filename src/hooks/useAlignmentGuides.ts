import { useCallback, useRef, useEffect } from 'react';
import type { Node } from '@xyflow/react';

const SNAP_THRESHOLD = 8; // pixels
const GUIDE_COLOR = 'hsl(52, 100%, 50%)';

interface Guide {
  type: 'vertical' | 'horizontal';
  pos: number;      // x for vertical, y for horizontal
  start: number;    // start of the line
  end: number;      // end of the line
}

function getNodeBounds(node: Node) {
  const w = (node.style?.width as number) || (node.measured?.width as number) || 300;
  const h = (node.style?.height as number) || (node.measured?.height as number) || 200;
  return {
    left: node.position.x,
    right: node.position.x + w,
    top: node.position.y,
    bottom: node.position.y + h,
    cx: node.position.x + w / 2,
    cy: node.position.y + h / 2,
    w,
    h,
  };
}

export function useAlignmentGuides(
  svgRef: React.RefObject<SVGSVGElement | null>,
  nodes: Node[],
  enabled: boolean
) {
  const guidesRef = useRef<Guide[]>([]);

  const computeGuides = useCallback(
    (draggedIds: string[], position: { x: number; y: number }) => {
      if (!enabled) return { guides: [], snapX: undefined, snapY: undefined };

      const dragged = nodes.find((n) => draggedIds.includes(n.id));
      if (!dragged) return { guides: [], snapX: undefined, snapY: undefined };

      const db = getNodeBounds({ ...dragged, position });
      const guides: Guide[] = [];
      let snapX: number | undefined;
      let snapY: number | undefined;
      let bestDx = SNAP_THRESHOLD + 1;
      let bestDy = SNAP_THRESHOLD + 1;

      for (const other of nodes) {
        if (draggedIds.includes(other.id)) continue;
        const ob = getNodeBounds(other);

        // Vertical alignment checks (x-axis snapping)
        const vChecks = [
          { dragVal: db.left, otherVal: ob.left },
          { dragVal: db.left, otherVal: ob.right },
          { dragVal: db.right, otherVal: ob.left },
          { dragVal: db.right, otherVal: ob.right },
          { dragVal: db.cx, otherVal: ob.cx },
        ];

        for (const { dragVal, otherVal } of vChecks) {
          const dx = Math.abs(dragVal - otherVal);
          if (dx < SNAP_THRESHOLD && dx < bestDx) {
            bestDx = dx;
            snapX = position.x + (otherVal - dragVal);
            guides.push({
              type: 'vertical',
              pos: otherVal,
              start: Math.min(db.top, ob.top) - 20,
              end: Math.max(db.bottom, ob.bottom) + 20,
            });
          }
        }

        // Horizontal alignment checks (y-axis snapping)
        const hChecks = [
          { dragVal: db.top, otherVal: ob.top },
          { dragVal: db.top, otherVal: ob.bottom },
          { dragVal: db.bottom, otherVal: ob.top },
          { dragVal: db.bottom, otherVal: ob.bottom },
          { dragVal: db.cy, otherVal: ob.cy },
        ];

        for (const { dragVal, otherVal } of hChecks) {
          const dy = Math.abs(dragVal - otherVal);
          if (dy < SNAP_THRESHOLD && dy < bestDy) {
            bestDy = dy;
            snapY = position.y + (otherVal - dragVal);
            guides.push({
              type: 'horizontal',
              pos: otherVal,
              start: Math.min(db.left, ob.left) - 20,
              end: Math.max(db.right, ob.right) + 20,
            });
          }
        }
      }

      guidesRef.current = guides;
      return { guides, snapX, snapY };
    },
    [nodes, enabled]
  );

  const renderGuides = useCallback(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    // Clear old guides
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    for (const g of guidesRef.current) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      if (g.type === 'vertical') {
        line.setAttribute('x1', String(g.pos));
        line.setAttribute('x2', String(g.pos));
        line.setAttribute('y1', String(g.start));
        line.setAttribute('y2', String(g.end));
      } else {
        line.setAttribute('x1', String(g.start));
        line.setAttribute('x2', String(g.end));
        line.setAttribute('y1', String(g.pos));
        line.setAttribute('y2', String(g.pos));
      }
      line.setAttribute('stroke', GUIDE_COLOR);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4 3');
      line.setAttribute('opacity', '0.7');
      svg.appendChild(line);
    }
  }, [svgRef]);

  const clearGuides = useCallback(() => {
    guidesRef.current = [];
    if (svgRef.current) {
      while (svgRef.current.firstChild) svgRef.current.removeChild(svgRef.current.firstChild);
    }
  }, [svgRef]);

  return { computeGuides, renderGuides, clearGuides };
}
