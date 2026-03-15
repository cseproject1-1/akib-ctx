import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '@/store/canvasStore';
import { MousePointer2 } from 'lucide-react';

export const MagicCursorsLayer = () => {
  const cursors = useCanvasStore((s) => s.cursors);
  const currentUser = { id: 'local' }; // Simplified for now, in real app would use auth.currentUser?.uid

  return (
    <div className="pointer-events-none absolute inset-0 z-[100] overflow-hidden">
      <AnimatePresence>
        {Object.entries(cursors)
          .filter(([id]) => id !== currentUser.id)
          .map(([id, cursor]) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: cursor.x,
                y: cursor.y 
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ 
                type: 'spring', 
                damping: 30, 
                stiffness: 300, 
                mass: 0.8 
              }}
              className="absolute left-0 top-0 flex items-center gap-1.5"
            >
              <MousePointer2 
                className="h-5 w-5 drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)]"
                style={{ color: cursor.color, fill: cursor.color }}
              />
              <div 
                className="rounded-full border-2 border-background px-2 py-0.5 text-[10px] font-bold text-white shadow-[2px_2px_0px_rgba(0,0,0,0.2)]"
                style={{ backgroundColor: cursor.color }}
              >
                {cursor.name}
              </div>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
};
