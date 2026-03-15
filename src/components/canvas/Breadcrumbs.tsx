import React, { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { ChevronRight, Home, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbsProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string;
  onNavigate: (nodeId: string) => void;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onNavigate,
  className
}) => {
  const path = useMemo(() => {
    if (!selectedNodeId) return [];
    
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const result: Node[] = [];
    let currentId: string | undefined = selectedNodeId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      const node = nodeMap.get(currentId);
      if (!node) break;
      result.unshift(node);
      visited.add(currentId);

      // Find primary parent (first edge targeting this node)
      const parentEdge = edges.find(e => e.target === currentId);
      currentId = parentEdge?.source;
    }

    return result;
  }, [nodes, edges, selectedNodeId]);

  if (path.length <= 1 && !selectedNodeId) return null;

  return (
    <div className={cn(
      "flex items-center gap-1 px-3 py-1.5",
      "bg-background/60 backdrop-blur-md border border-border/50",
      "rounded-full shadow-sm text-xs font-medium text-muted-foreground",
      "transition-all duration-300 hover:border-primary/30",
      className
    )}>
      <button 
        onClick={() => onNavigate('')}
        className="hover:text-primary transition-colors p-0.5"
        title="View All"
      >
        <Home size={14} />
      </button>
      
      {path.map((node, index) => (
        <React.Fragment key={node.id}>
          <ChevronRight size={12} className="opacity-40" />
          <button
            onClick={() => onNavigate(node.id)}
            className={cn(
              "hover:text-primary transition-colors max-w-[120px] truncate px-1 rounded-sm",
              index === path.length - 1 && "text-foreground font-bold"
            )}
            title={(node.data?.label as string) || node.id}
          >
            {(node.data?.label as string) || 'Untitled Node'}
          </button>
        </React.Fragment>
      ))}

      {path.length > 0 && (
        <div className="ml-1 pl-1 border-l border-border/50 flex items-center">
          <Target size={12} className="text-primary animate-pulse" />
        </div>
      )}
    </div>
  );
};
