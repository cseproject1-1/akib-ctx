import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pin, 
  X, 
  PinOff,
  Map,
  FileText,
  Target
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { useNodes, type Node } from '@xyflow/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MobilePinnedNodesProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobilePinnedNodes({ isOpen, onClose }: MobilePinnedNodesProps) {
  const nodes = useNodes();
  const expandedNode = useCanvasStore((s) => s.expandedNode);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const focusMode = useCanvasStore((s) => s.focusMode);

  // Get nodes that are "pinned" (have special marker or are in focus mode)
  const pinnedNodes = nodes.filter(node => 
    node.data?.pinned || (focusMode && node.selected)
  );

  const handleGoToNode = (node: Node) => {
    setExpandedNode(node.id);
    toast.success(`Opening "${node.data?.title || 'Node'}"`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="w-full max-w-lg bg-background rounded-t-3xl max-h-[70vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Pin className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Pinned Nodes</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Pinned Nodes List */}
          <div className="flex-1 overflow-y-auto p-2">
            {pinnedNodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Pin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No pinned nodes yet</p>
                <p className="text-sm">Pin nodes to keep them accessible</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {pinnedNodes.map((node) => {
                    const data = node.data as any;
                    const title = data?.title || data?.text || 'Untitled';
                    
                    return (
                      <motion.div
                        key={node.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border bg-card",
                          "hover:border-primary/50 transition-colors",
                          expandedNode === node.id && "border-primary/50 bg-primary/5"
                        )}
                        onClick={() => handleGoToNode(node)}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          "bg-primary/10 text-primary"
                        )}>
                          <Pin className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{title}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {node.type || 'Node'}
                          </p>
                        </div>
                        {expandedNode === node.id && (
                          <Target className="h-4 w-4 text-primary" />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
