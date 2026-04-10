import { memo, useState, useCallback, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { BaseNode } from './BaseNode';
import { Bookmark, Globe, Loader2, RefreshCw, X } from 'lucide-react';
import { BookmarkNodeData } from '@/types/canvas';
import { LinkPreview, LinkMetadata } from '@/components/canvas/LinkPreview';
import { fetchLinkMetadata } from '@/lib/metadataService';

/**
 * @component BookmarkNode
 * @description A clean URL bookmark card focused on high-quality previews and domain metadata.
 */
export const BookmarkNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const nodeData = data as unknown as BookmarkNodeData;

  const [inputUrl, setInputUrl] = useState(nodeData.url || '');
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);

  const loadMetadata = useCallback(async (url: string) => {
    if (!url) return;
    setLoading(true);
    try {
      const meta = await fetchLinkMetadata(url);
      setMetadata(meta);
      
      // Update store with new metadata for persistence
      updateNodeData(id, { 
        url: meta.url,
        ogTitle: meta.title, 
        ogDescription: meta.description, 
        ogImage: meta.image, 
        favicon: meta.icon,
        hostname: new URL(meta.url).hostname.replace('www.', '')
      });
    } catch (err) {
      console.error('Bookmark load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, updateNodeData]);

  useEffect(() => {
    if (nodeData.url && (!nodeData.ogTitle || !metadata)) {
      setMetadata({
        url: nodeData.url,
        title: nodeData.ogTitle,
        description: nodeData.ogDescription,
        image: nodeData.ogImage,
        icon: nodeData.favicon,
      });
      if (!nodeData.ogTitle) {
        loadMetadata(nodeData.url);
      }
    }
  }, [nodeData.url, nodeData.ogTitle, nodeData.ogDescription, nodeData.ogImage, nodeData.favicon, metadata, loadMetadata]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    let url = inputUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    
    updateNodeData(id, { url });
    loadMetadata(url);
  }, [id, inputUrl, loadMetadata, updateNodeData]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { url: '', ogTitle: '', ogDescription: '', ogImage: '', favicon: '', hostname: '' });
    setInputUrl('');
    setMetadata(null);
  }, [id, updateNodeData]);

  return (
    <BaseNode
      id={id}
      title={nodeData.ogTitle || 'Bookmark'}
      icon={<Bookmark className="h-4 w-4 text-primary" />}
      selected={selected}
      onTitleChange={(t) => updateNodeData(id, { ogTitle: t })}
      bodyClassName="p-2 min-h-[120px] bg-accent/5"
      nodeType="bookmark"
      onMenuClick={(e) => useCanvasStore.getState().setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      headerExtra={
        nodeData.url && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); loadMetadata(nodeData.url!); }}
              className="rounded-md p-1 text-muted-foreground/60 hover:bg-white/10 hover:text-foreground"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
            {!nodeData.locked && canvasMode === 'edit' && (
              <button onClick={(e) => { e.stopPropagation(); handleClear(); }} className="rounded-md p-1 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      }
    >
      <div className="flex-1" onClick={(e) => e.stopPropagation()}>
        {!nodeData.url ? (
          <form onSubmit={handleSubmit} className="flex h-full flex-col items-center justify-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <input
              className="w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-all focus:border-primary backdrop-blur-sm"
              placeholder="https://..."
              autoFocus
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </form>
        ) : (
          <div className="h-full">
            {metadata ? (
              <LinkPreview 
                metadata={metadata} 
                isLoading={loading} 
                className="h-full border-0 !bg-transparent !backdrop-blur-none !p-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary/30" />
              </div>
            )}
          </div>
        )}
      </div>
    </BaseNode>
  );
});

BookmarkNode.displayName = 'BookmarkNode';
