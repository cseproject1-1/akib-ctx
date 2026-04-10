import { memo, useState, useCallback, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Video, ExternalLink, X, MonitorPlay, LayoutGrid, Loader2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { VideoNodeData } from '@/types/canvas';
import { getEmbedConfig } from '@/lib/utils/embedUtils';
import { LinkPreview, LinkMetadata } from '@/components/canvas/LinkPreview';
import { fetchLinkMetadata } from '@/lib/metadataService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * @component VideoNode
 * @description Dedicated node for video content (YouTube, Vimeo, etc.) with premium player UI.
 */
export const VideoNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const nodeData = data as unknown as VideoNodeData & { preferredMode?: 'embed' | 'bookmark' };
  
  const [inputUrl, setInputUrl] = useState(nodeData.url || '');
  const [editing, setEditing] = useState(!nodeData.url);
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);

  const currentMode = nodeData.preferredMode || 'embed';

  const loadMetadata = useCallback(async (url: string) => {
    setLoading(true);
    try {
      const meta = await fetchLinkMetadata(url);
      setMetadata(meta);
      if (meta.title && !nodeData.title) {
        updateNodeData(id, { title: meta.title });
      }
    } catch (err) {
      console.error('Video metadata error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, nodeData.title, updateNodeData]);

  useEffect(() => {
    if (nodeData.url) {
      loadMetadata(nodeData.url);
    }
  }, [nodeData.url, loadMetadata]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    let url = inputUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    
    updateNodeData(id, { url, title: nodeData.title || url });
    setEditing(false);
    setIframeLoading(true);
  }, [id, inputUrl, nodeData.title, updateNodeData]);

  const handleToggleMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newMode = currentMode === 'embed' ? 'bookmark' : 'embed';
    updateNodeData(id, { preferredMode: newMode } as any);
  }, [currentMode, id, updateNodeData]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { url: '', title: '', preferredMode: undefined } as any);
    setInputUrl('');
    setEditing(true);
    setMetadata(null);
  }, [id, updateNodeData]);

  const embedConfig = nodeData.url ? getEmbedConfig(nodeData.url) : null;
  const iframeSrc = embedConfig?.embedUrl || '';

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Video'}
      icon={<Video className="h-4 w-4 text-red" />}
      selected={selected}
      onTitleChange={(t) => updateNodeData(id, { title: t })}
      bodyClassName="p-0 flex flex-col aspect-video min-h-[160px]"
      nodeType="video"
      onMenuClick={(e) => useCanvasStore.getState().setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      headerExtra={
        nodeData.url && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleMode}
              className={cn(
                "rounded-md p-1 transition-all hover:bg-white/10",
                currentMode === 'bookmark' ? "text-primary bg-primary/10" : "text-muted-foreground/60"
              )}
            >
              {currentMode === 'embed' ? <LayoutGrid className="h-3.5 w-3.5" /> : <MonitorPlay className="h-3.5 w-3.5" />}
            </button>
            <a href={nodeData.url} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-muted-foreground/60 hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {!nodeData.locked && canvasMode === 'edit' && (
              <button onClick={(e) => { e.stopPropagation(); handleClear(); }} className="rounded p-1 text-muted-foreground/60 hover:text-destructive transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      }
    >
      <div className="flex-1 w-full h-full" onClick={(e) => e.stopPropagation()}>
        {editing || !nodeData.url ? (
          <form onSubmit={handleSubmit} className="flex h-full flex-col items-center justify-center gap-4 p-6 bg-accent/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Video className="h-6 w-6" />
            </div>
            <div className="w-full space-y-2">
              <input
                className="w-full rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary backdrop-blur-sm"
                placeholder="YouTube or Vimeo URL"
                autoFocus
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
              />
              <button
                type="submit"
                disabled={!inputUrl.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-destructive/20 transition-all hover:translate-y-[-1px]"
              >
                Embed Video
              </button>
            </div>
          </form>
        ) : currentMode === 'bookmark' || !iframeSrc ? (
          <div className="h-full p-2 bg-gradient-to-br from-accent/5 to-primary/5">
            {metadata ? (
              <LinkPreview 
                metadata={metadata} 
                isLoading={loading} 
                className="h-full border-0 !bg-transparent !backdrop-blur-none"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center opacity-40">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Loading Metadata</span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-full group">
            {iframeLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/80 backdrop-blur-sm z-10 transition-opacity">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-destructive/20" />
                  <Video className="relative h-8 w-8 text-destructive animate-pulse" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Warming up player</span>
              </div>
            )}
            <iframe
              src={iframeSrc}
              title={nodeData.title || 'Video'}
              className={cn(
                "h-full w-full border-0 transition-opacity duration-700",
                iframeLoading ? "opacity-0" : "opacity-100"
              )}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation"
              allowFullScreen
              loading="lazy"
              onLoad={() => setIframeLoading(false)}
            />

          </div>
        )}
      </div>
    </BaseNode>
  );
});

VideoNode.displayName = 'VideoNode';
