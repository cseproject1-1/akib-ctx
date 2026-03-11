import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCanvasStore } from '@/store/canvasStore';

const MOCK_USERS = [
  { id: '1', name: 'You', color: '#6366f1', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=you' },
  { id: '2', name: 'Nexus AI', color: '#10b981', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=nexus' },
];

export const PresenceList = () => {
  // In a real app, this would come from a presence hook (Yjs or Firestore)
  const users = MOCK_USERS;

  return (
    <TooltipProvider>
      <div className="flex items-center -space-x-2">
        <AnimatePresence>
          {users.map((user, i) => (
            <Tooltip key={user.id}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.5, x: 20 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative group cursor-pointer"
                >
                  <div 
                    className="h-8 w-8 rounded-full border-2 border-background ring-2 ring-transparent transition-all group-hover:ring-primary/40 group-hover:-translate-y-1 shadow-md overflow-hidden bg-muted"
                    style={{ borderColor: i === 0 ? user.color : 'white' }}
                  >
                    <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                  </div>
                  {i === 0 && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                  )}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="premium-tooltip">
                <span className="font-bold">{user.name}</span> {i === 0 ? '(Viewing)' : '(Thinking...)'}
              </TooltipContent>
            </Tooltip>
          ))}
        </AnimatePresence>
        
        <Tooltip>
           <TooltipTrigger asChild>
             <button className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px] font-bold text-muted-foreground/60 hover:bg-muted/50 transition-colors ml-2">
               +
             </button>
           </TooltipTrigger>
           <TooltipContent className="premium-tooltip">
             Invite collaborators
           </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
