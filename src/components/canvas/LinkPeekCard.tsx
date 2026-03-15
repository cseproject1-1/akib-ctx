
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Globe, Layout, Loader2 } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { fetchLinkMetadata, type LinkMetadata } from '@/lib/metadataService';

export function LinkPeekCard() {
  const hoveredLink = useCanvasStore((s) => s.hoveredLink);
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hoveredLink) {
      setMetadata(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    fetchLinkMetadata(hoveredLink.url).then((data) => {
      if (mounted) {
        setMetadata(data);
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [hoveredLink]);

  if (!hoveredLink) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className="fixed z-[300] w-[300px] pointer-events-none"
        style={{
          left: hoveredLink.x,
          top: hoveredLink.y + 20, // Offset below the cursor
        }}
      >
        <div className="rounded-2xl border-2 border-primary bg-card p-4 shadow-[var(--brutal-shadow-lg)] flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Fetching Metadata...</span>
            </div>
          ) : (
            <>
              {metadata?.image && (
                <div className="relative h-32 w-full overflow-hidden rounded-xl border-2 border-border mb-1">
                  <img 
                    src={metadata.image} 
                    alt={metadata.title} 
                    className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-primary/10 mix-blend-multiply" />
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-lg border-2 border-border bg-muted p-2 text-primary shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  {metadata?.icon ? (
                    <img src={metadata.icon} className="h-4 w-4" alt="favicon" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black uppercase tracking-tight text-foreground line-clamp-2 leading-none mb-1 text-primary italic">
                    {metadata?.title || metadata?.url || 'Preview Link'}
                  </h4>
                  <p className="text-[10px] font-medium text-muted-foreground line-clamp-3 leading-relaxed mb-3">
                    {metadata?.description || 'No description available for this destination.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t-2 border-border/10">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  <Layout className="h-3 w-3" />
                  {new URL(hoveredLink.url).hostname}
                </div>
                <div className="flex items-center gap-1 text-[9px] font-black text-primary uppercase italic">
                  Link Ready <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
