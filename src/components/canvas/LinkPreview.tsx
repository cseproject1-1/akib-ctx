import React from 'react';
import { ExternalLink, Globe, Play, Youtube } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  url: string;
  icon?: string;
}

interface LinkPreviewProps {
  metadata: LinkMetadata;
  isLoading?: boolean;
  className?: string;
  variant?: 'node' | 'modal';
}

/**
 * @component LinkPreview
 * @description A premium, glassmorphic card for displaying link metadata.
 */
export const LinkPreview: React.FC<LinkPreviewProps> = ({
  metadata,
  isLoading,
  className,
  variant = 'node',
}) => {
  const isVideo = /youtube\.com|youtu\.be|vimeo\.com|loom\.com|tiktok\.com|spotify\.com/.test(metadata.url);
  const isYoutube = /youtube\.com|youtu\.be/.test(metadata.url);

  if (isLoading) {
    return (
      <div className={cn(
        "relative flex flex-col gap-3 rounded-xl border border-border/30 bg-card/50 p-4 backdrop-blur-sm",
        className
      )}>
        <div className="h-32 w-full animate-pulse rounded-lg bg-muted/20" />
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted/20" />
          <div className="h-3 w-full animate-pulse rounded bg-muted/20" />
        </div>
      </div>
    );
  }

  let hostname = '';
  try {
    hostname = new URL(metadata.url).hostname.replace('www.', '');
  } catch {
    hostname = metadata.url;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/30 bg-card/40 transition-all hover:bg-card/60 backdrop-blur-md",
        variant === 'modal' ? 'w-full max-w-2xl' : 'w-full h-full',
        className
      )}
    >
      {/* Background Glow */}
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/5 blur-3xl transition-opacity group-hover:opacity-100" />

      {/* Hero Image / Video Thumbnail */}
      {metadata.image && (
        <div className={cn(
          "relative overflow-hidden border-b border-border/10 flex-shrink-0",
          variant === 'modal' ? 'aspect-video' : 'h-32'
        )}>
          <img
            src={metadata.image}
            alt={metadata.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          
          {/* Play Overlay for Videos */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black shadow-xl transition-transform group-hover:scale-110">
                {isYoutube ? <Youtube className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 min-h-0">
        <div className="mb-2 flex items-center gap-2">
          {metadata.icon ? (
            <img src={metadata.icon} alt="" className="h-4 w-4 rounded-sm flex-shrink-0" />
          ) : (
            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 truncate">{hostname}</span>
        </div>

        <h3 className={cn(
          "font-bold text-foreground line-clamp-2 leading-tight mb-1",
          variant === 'modal' ? 'text-xl' : 'text-sm'
        )}>
          {metadata.title || metadata.url}
        </h3>

        {metadata.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
            {metadata.description}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2">
          <a
            href={metadata.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex flex-1 items-center gap-2 rounded-lg bg-accent/50 px-3 py-2 text-[11px] font-bold text-foreground transition-colors hover:bg-accent overflow-hidden"
          >
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{metadata.url}</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
};
