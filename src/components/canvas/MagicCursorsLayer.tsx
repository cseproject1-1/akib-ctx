import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { MousePointer2 } from 'lucide-react';
import { auth } from '@/lib/firebase/client';

export const MagicCursorsLayer = () => {
  const cursors = useCanvasStore((s) => s.cursors);
  const currentUserId = auth.currentUser?.uid || 'local';
  
  // Connect to the ReactFlow transform to sync flow coordinates with screen position
  const [x, y, zoom] = useStore((s) => s.transform);

  return (
    <div 
      className="pointer-events-none absolute inset-0 z-magic-cursors overflow-hidden" 
      style={{ 
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        transformOrigin: '0 0'
      }}
    >
      <AnimatePresence mode="popLayout">
        {Object.entries(cursors)
          .filter(([id]) => id !== currentUserId && id !== 'local')
          .map(([id, cursor]) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, scale: 0.8, x: cursor.x, y: cursor.y }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: cursor.x,
                y: cursor.y 
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ 
                type: 'spring', 
                damping: 40, 
                stiffness: 400, 
                mass: 0.5 
              }}
              className="absolute left-0 top-0 flex items-center gap-1.5"
              style={{
                // Prevent labels from scaling down with the canvas too much
                scale: Math.max(1, 1 / zoom)
              }}
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
