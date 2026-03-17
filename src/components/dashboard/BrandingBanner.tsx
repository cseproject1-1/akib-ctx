import React from 'react';
import { motion } from 'framer-motion';

export const BrandingBanner = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-8 overflow-hidden rounded-2xl border-2 border-border bg-card p-8 shadow-[var(--clay-shadow-sm)]"
    >
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <img 
            src="/logo.png" 
            alt="CTXNOTE" 
            className="h-12 w-auto object-contain mb-4 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.1)]" 
          />
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
            Infinite Workspace for <span className="text-primary">Deep Thinking</span>
          </h1>
          <p className="mt-2 max-w-lg text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Spatial canvas for notes, research, and creative flow.
          </p>
        </div>
        
        <div className="hidden lg:flex items-center gap-4">
           {/* Decorative elements or quick stats could go here */}
           <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-10 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
              <div className="h-10 w-10 rounded-full border-2 border-card bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                +12
              </div>
           </div>
        </div>
      </div>
      
      {/* Background patterns */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
    </motion.div>
  );
};
