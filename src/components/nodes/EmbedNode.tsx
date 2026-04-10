import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Globe, ExternalLink, X, LayoutGrid, MonitorPlay, RefreshCw, Loader2 } from 'lucide-react';
import { EmbedNodeData } from '@/types/canvas';
import { BaseNode } from './BaseNode';
import { LinkPreview, LinkMetadata } from '@/components/canvas/LinkPreview';
import { fetchLinkMetadata } from '@/lib/metadataService';
import { getEmbedConfig, isRestrictedSite } from '@/lib/utils/embedUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * @component EmbedNode
 * @description A versatile node that can show either a live website embed or a rich metadata bookmark card.
 */
export const EmbedNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const nodeData = data as unknown as EmbedNodeData & { preferredMode?: 'embed' | 'bookmark' };
  
  const [inputUrl, setInputUrl] = useState(nodeData.url || '');
  const [editing, setEditing] = useState(!nodeData.url);
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  
  const iframeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeLoadedRef = useRef(false);

  // Sync mode with site restrictions
  const currentMode = nodeData.preferredMode || (isRestrictedSite(nodeData.url || '') ? 'bookmark' : 'embed');

  const loadMetadata = useCallback(async (url: string) => {
    setLoading(true);
    try {
      const meta = await fetchLinkMetadata(url);
      setMetadata(meta);
      if (meta.title && !nodeData.title) {
        updateNodeData(id, { title: meta.title });
      }
    } catch (err) {
      console.error('Metadata load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, nodeData.title, updateNodeData]);

  useEffect(() => {
    if (nodeData.url && (currentMode === 'bookmark' || iframeFailed)) {
      loadMetadata(nodeData.url);
    }
  }, [nodeData.url, currentMode, iframeFailed, loadMetadata]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    let url = inputUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    
    updateNodeData(id, { url, title: nodeData.title || url });
    setEditing(false);
    setIframeFailed(isRestrictedSite(url));
    setIframeLoading(true);
  }, [id, inputUrl, nodeData.title, updateNodeData]);

  const handleToggleMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newMode = currentMode === 'embed' ? 'bookmark' : 'embed';
    updateNodeData(id, { preferredMode: newMode } as any);
    toast.info(`Switched to ${newMode} mode`);
  }, [currentMode, id, updateNodeData]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { url: '', title: '', preferredMode: undefined } as any);
    setInputUrl('');
    setEditing(true);
    setMetadata(null);
    setIframeFailed(false);
  }, [id, updateNodeData]);

  // Iframe error detection
  useEffect(() => {
    if (currentMode !== 'embed' || !nodeData.url || editing) return;
    
    setIframeLoading(true);
    iframeLoadedRef.current = false;
    
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
    
    // If not a known embeddable site, start a timer to detect failure
    const embedConfig = getEmbedConfig(nodeData.url);
    if (!embedConfig) {
      iframeTimerRef.current = setTimeout(() => {
        if (!iframeLoadedRef.current) {
          setIframeFailed(true);
          setIframeLoading(false);
        }
      }, 3000);
    }

    return () => {
      if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
    };
  }, [nodeData.url, currentMode, editing]);

  const embedConfig = nodeData.url ? getEmbedConfig(nodeData.url) : null;
  const iframeSrc = embedConfig?.embedUrl || nodeData.url || '';

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Embed'}
      icon={<Globe className="h-4 w-4 text-cyan" />}
      selected={selected}
      onTitleChange={(t) => updateNodeData(id, { title: t })}
      bodyClassName="p-0 flex flex-col min-h-[160px]"
      nodeType="embed"
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
              title={currentMode === 'embed' ? "Switch to Bookmark Card" : "Switch to Live Embed"}
            >
              {currentMode === 'embed' ? <LayoutGrid className="h-3.5 w-3.5" /> : <MonitorPlay className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); loadMetadata(nodeData.url!); }}
              className="rounded-md p-1 text-muted-foreground/60 hover:bg-white/10 hover:text-foreground"
              title="Refresh Metadata"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
            {!nodeData.locked && canvasMode === 'edit' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleClear(); }} 
                className="rounded-md p-1 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      }
    >
      <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {editing || !nodeData.url ? (
          <form onSubmit={handleSubmit} className="flex h-full flex-col items-center justify-center gap-4 p-6 bg-accent/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Globe className="h-6 w-6" />
            </div>
            <div className="w-full space-y-2">
              <input
                className="w-full rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 backdrop-blur-sm"
                placeholder="Paste a URL (YouTube, Figma, Twitter, etc.)"
                autoFocus
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              />
              <button
                type="submit"
                disabled={!inputUrl.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:translate-y-[-2px] hover:shadow-xl active:translate-y-0 disabled:opacity-50"
              >
                Create Embed
              </button>
            </div>
          </form>
        ) : (currentMode === 'bookmark' || iframeFailed) ? (
          <div className="h-full p-2 bg-gradient-to-br from-accent/5 to-primary/5">
            {metadata ? (
              <LinkPreview 
                metadata={metadata} 
                isLoading={loading} 
                className="h-full border-0 !bg-transparent !backdrop-blur-none"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                      <X className="h-5 w-5" />
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {iframeFailed ? "This site prevents embedding. Showing as bookmark." : "Loading preview..."}
                    </p>
                    <a 
                      href={nodeData.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:underline"
                    >
                      Open in New Tab <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="relative h-full w-full group">
            {iframeLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/60 backdrop-blur-sm z-10 transition-opacity duration-300">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  <Loader2 className="relative h-8 w-8 animate-spin text-primary" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Securely Connecting</span>
              </div>
            )}
            <iframe
              src={iframeSrc}
              title={nodeData.title || 'Embed'}
              className={cn(
                "h-full w-full border-0 transition-all duration-700",
                iframeLoading ? "scale-[0.98] opacity-0" : "scale-100 opacity-100"
              )}
              sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation"

              loading="lazy"
              onLoad={() => {
                setIframeLoading(false);
                iframeLoadedRef.current = true;
              }}
              onError={() => {
                setIframeLoading(false);
                setIframeFailed(true);
              }}
            />
          </div>
        )}
      </div>
    </BaseNode>
  );
});

EmbedNode.displayName = 'EmbedNode';
