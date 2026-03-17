import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Edit2, 
  Copy, 
  Trash2, 
  GripVertical,
  Pin,
  Link,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/store/canvasStore';

interface MobileNodeContextMenuProps {
  isOpen: boolean;
  nodeId: string;
  onClose: () => void;
  position: { x: number; y: number };
}

export function MobileNodeContextMenu({ 
  isOpen, 
  nodeId, 
  onClose,
  position 
}: MobileNodeContextMenuProps) {
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);

  const handleAction = (action: string) => {
    switch (action) {
      case 'edit':
        setExpandedNode(nodeId);
        break;
      case 'duplicate':
        duplicateNode(nodeId);
        break;
      case 'delete':
        deleteNode(nodeId);
        break;
      case 'copy':
        navigator.clipboard.writeText(nodeId);
        break;
      case 'pin':
        // Toggle pin functionality
        break;
      case 'share':
        if (navigator.share) {
          navigator.share({ text: `Node: ${nodeId}` });
        }
        break;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30"
            onClick={onClose}
          />
          
          {/* Bottom Sheet Menu */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-lg"
          >
            <div className="p-2">
              <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto mb-3" />
            </div>
            
            <div className="px-4 pb-4 space-y-1">
              <button
                onClick={() => handleAction('edit')}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors"
              >
                <Edit2 className="h-5 w-5 text-muted-foreground" />
                <span>Edit</span>
              </button>
              
              <button
                onClick={() => handleAction('duplicate')}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors"
              >
                <Copy className="h-5 w-5 text-muted-foreground" />
                <span>Duplicate</span>
              </button>
              
              <button
                onClick={() => handleAction('pin')}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors"
              >
                <Pin className="h-5 w-5 text-muted-foreground" />
                <span>Pin</span>
              </button>
              
              <button
                onClick={() => handleAction('share')}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors"
              >
                <Share2 className="h-5 w-5 text-muted-foreground" />
                <span>Share</span>
              </button>
              
              <div className="border-t border-border/50 my-2" />
              
              <button
                onClick={() => handleAction('delete')}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-destructive/10 text-destructive transition-colors"
              >
                <Trash2 className="h-5 w-5" />
                <span>Delete</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
