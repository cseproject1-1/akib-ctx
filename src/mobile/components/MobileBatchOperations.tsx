import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  Copy, 
  Minimize2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Group,
  Layers,
  GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBatchOperations } from '@/mobile/hooks/useBatchOperations';

interface MobileBatchOperationsProps {
  isOpen: boolean;
  selectedNodeIds: string[];
  onClose: () => void;
  onClearSelection: () => void;
}

export function MobileBatchOperations({ 
  isOpen, 
  selectedNodeIds,
  onClose,
  onClearSelection 
}: MobileBatchOperationsProps) {
  const { deleteNodes, duplicateNodes, groupNodes, alignNodes, moveNodes } = useBatchOperations();

  const handleAction = (action: string) => {
    switch (action) {
      case 'delete':
        deleteNodes(selectedNodeIds);
        onClearSelection();
        break;
      case 'duplicate':
        duplicateNodes(selectedNodeIds);
        break;
      case 'group':
        groupNodes(selectedNodeIds);
        break;
      case 'align-left':
        alignNodes(selectedNodeIds, 'left');
        break;
      case 'align-center':
        alignNodes(selectedNodeIds, 'center');
        break;
      case 'align-right':
        alignNodes(selectedNodeIds, 'right');
        break;
      case 'align-top':
        alignNodes(selectedNodeIds, 'top');
        break;
      case 'align-bottom':
        alignNodes(selectedNodeIds, 'bottom');
        break;
      case 'move-up':
        moveNodes(selectedNodeIds, 0, -20);
        break;
      case 'move-down':
        moveNodes(selectedNodeIds, 0, 20);
        break;
      case 'move-left':
        moveNodes(selectedNodeIds, -20, 0);
        break;
      case 'move-right':
        moveNodes(selectedNodeIds, 20, 0);
        break;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && selectedNodeIds.length > 0 && (
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
              <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto mb-2" />
              <div className="text-center text-sm font-medium text-muted-foreground mb-2">
                {selectedNodeIds.length} node(s) selected
              </div>
            </div>
            
            <div className="px-4 pb-4 space-y-1 max-h-[50vh] overflow-y-auto">
              {/* Selection actions */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <button
                  onClick={() => handleAction('move-left')}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-accent/50 transition-colors"
                >
                  <GripVertical className="h-5 w-5 -rotate-90 text-muted-foreground" />
                  <span className="text-xs">Left</span>
                </button>
                <button
                  onClick={() => handleAction('move-up')}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-accent/50 transition-colors"
                >
                  <GripVertical className="h-5 w-5 -rotate-180 text-muted-foreground" />
                  <span className="text-xs">Up</span>
                </button>
                <button
                  onClick={() => handleAction('move-down')}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-accent/50 transition-colors"
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs">Down</span>
                </button>
                <button
                  onClick={() => handleAction('move-right')}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-accent/50 transition-colors"
                >
                  <GripVertical className="h-5 w-5 rotate-90 text-muted-foreground" />
                  <span className="text-xs">Right</span>
                </button>
              </div>

              {/* Alignment */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">Align</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="grid grid-cols-5 gap-2 mb-4">
                <button
                  onClick={() => handleAction('align-left')}
                  className="p-2 rounded-xl hover:bg-accent/50 transition-colors"
                  title="Align Left"
                >
                  <AlignLeft className="h-5 w-5 mx-auto text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleAction('align-center')}
                  className="p-2 rounded-xl hover:bg-accent/50 transition-colors"
                  title="Align Center"
                >
                  <AlignCenter className="h-5 w-5 mx-auto text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleAction('align-right')}
                  className="p-2 rounded-xl hover:bg-accent/50 transition-colors"
                  title="Align Right"
                >
                  <AlignRight className="h-5 w-5 mx-auto text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleAction('align-top')}
                  className="p-2 rounded-xl hover:bg-accent/50 transition-colors"
                  title="Align Top"
                >
                  <Layers className="h-5 w-5 mx-auto text-muted-foreground rotate-90" />
                </button>
                <button
                  onClick={() => handleAction('align-bottom')}
                  className="p-2 rounded-xl hover:bg-accent/50 transition-colors"
                  title="Align Bottom"
                >
                  <Layers className="h-5 w-5 mx-auto text-muted-foreground -rotate-90" />
                </button>
              </div>

              {/* Main actions */}
              <button
                onClick={() => handleAction('duplicate')}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors"
              >
                <Copy className="h-5 w-5 text-muted-foreground" />
                <span>Duplicate</span>
              </button>
              
              <button
                onClick={() => handleAction('group')}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors"
              >
                <Group className="h-5 w-5 text-muted-foreground" />
                <span>Group</span>
              </button>
              
              <div className="border-t border-border/50 my-2" />
              
              <button
                onClick={() => handleAction('delete')}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-destructive/10 text-destructive transition-colors"
              >
                <Trash2 className="h-5 w-5" />
                <span>Delete {selectedNodeIds.length} node(s)</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default MobileBatchOperations;
