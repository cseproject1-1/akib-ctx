import { type Node, type Edge } from '@xyflow/react';

/**
 * Simple Tidy Tree layout algorithm
 * Arranges nodes in a hierarchical tree based on edges.
 */
export function getTreeLayout(nodes: Node[], edges: Edge[]) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach(n => {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  edges.forEach(e => {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  });

  const roots = nodes.filter(n => (inDegree.get(n.id) || 0) === 0);
  if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0]); // fallback for cycles

  const levels: Map<string, number> = new Map();
  const levelNodes: Map<number, string[]> = new Map();

  const traverse = (id: string, depth: number, visited: Set<string>) => {
    if (visited.has(id)) return;
    visited.add(id);

    const currentDepth = Math.max(levels.get(id) || 0, depth);
    levels.set(id, currentDepth);

    if (!levelNodes.has(currentDepth)) levelNodes.set(currentDepth, []);
    if (!levelNodes.get(currentDepth)?.includes(id)) {
      levelNodes.get(currentDepth)?.push(id);
    }

    adj.get(id)?.forEach(childId => traverse(childId, depth + 1, visited));
  };

  const visited = new Set<string>();
  roots.forEach(root => traverse(root.id, 0, visited));

  // Also catch orphans
  nodes.forEach(n => {
    if (!visited.has(n.id)) traverse(n.id, 0, visited);
  });

  const gapX = 450;
  const gapY = 350;

  const newNodes = nodes.map(n => {
    const level = levels.get(n.id) || 0;
    const sameLevelIds = levelNodes.get(level) || [];
    const idx = sameLevelIds.indexOf(n.id);
    const totalInLevel = sameLevelIds.length;

    return {
      ...n,
      position: {
        x: (idx - (totalInLevel - 1) / 2) * gapX,
        y: level * gapY,
      }
    };
  });

  return newNodes;
}

/**
 * Circular layout for visualizing networks
 */
export function getCircularLayout(nodes: Node[]) {
  const radius = Math.max(nodes.length * 80, 400);
  const center = { x: 0, y: 0 };

  return nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    return {
      ...n,
      position: {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      }
    };
  });
}
