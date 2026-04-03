import React, { useMemo } from 'react';
import { useReactFlow, type Node, type Edge } from '@xyflow/react';
import { ChevronRight, Home, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
  const { fitView } = useReactFlow();
  
  const renderBreadcrumb = (node: Node, isLast: boolean, index: number) => {
    const handleBreadcrumbClick = () => {
      onNavigate(node.id);
      fitView({ nodes: [node], duration: 800, padding: 0.5 });
    };

    return (
      <React.Fragment key={node.id}>
        <ChevronRight size={12} className="opacity-40" />
        <div className="relative group/breadcrumb">
          <button
            onClick={handleBreadcrumbClick}
            className={cn(
              "hover:text-primary transition-colors max-w-[120px] truncate px-1 rounded-sm",
              isLast && "text-foreground font-bold"
            )}
          >
            {(node.data?.title as string) || (node.data?.label as string) || 'Untitled Note'}
          </button>
          
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              whileHover={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 rounded-xl glass-effect border border-white/10 shadow-xl pointer-events-none opacity-0 group-hover/breadcrumb:opacity-100 transition-opacity z-50"
            >
              <div className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">
                {node.type} Glimpse
              </div>
              <div className="text-[11px] font-bold text-foreground line-clamp-2 mb-2">
                {(node.data?.title as string) || (node.data?.label as string) || 'No title'}
              </div>
              <div className="flex gap-2 text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60">
                <span>{edges.filter(e => e.source === node.id || e.target === node.id).length} Links</span>
                <span className="w-1 h-1 bg-border rounded-full self-center" />
                <span>Active</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </React.Fragment>
    );
  };

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
      >
        <Home size={14} />
      </button>
      
      {(() => {
        if (path.length <= 4) {
          return path.map((node, index) => renderBreadcrumb(node, index === path.length - 1, index));
        }
        
        // Truncate: Home > First > ... > Penultimate > Last
        const first = path[0];
        const penultimate = path[path.length - 2];
        const last = path[path.length - 1];

        return (
          <>
            {renderBreadcrumb(first, false, 0)}
            <ChevronRight size={12} className="opacity-40" />
            <span className="px-1 opacity-40">...</span>
            {renderBreadcrumb(penultimate, false, path.length - 2)}
            {renderBreadcrumb(last, true, path.length - 1)}
          </>
        );
      })()}

      {path.length > 0 && (
        <div className="ml-1 pl-1 border-l border-border/50 flex items-center">
          <Target size={12} className="text-primary animate-pulse" />
        </div>
      )}
    </div>
  );
};
