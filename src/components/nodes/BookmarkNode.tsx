import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { BaseNode } from './BaseNode';
import { Bookmark, ExternalLink, Globe, Loader2, RefreshCw } from 'lucide-react';
import { BookmarkNodeData } from '@/types/canvas';

/**
 * @component BookmarkNode
 * @description URL bookmark card that shows a favicon, title, description, and link preview.
 * Metadata is fetched from an Open Graph proxy.
 * @param {NodeProps} props - React Flow node props
 */
export const BookmarkNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as BookmarkNodeData;

  const [inputUrl, setInputUrl] = useState(nodeData.url || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const hasData = !!(nodeData.url && nodeData.ogTitle);

  /**
   * Fetch OG metadata via an allorigins proxy (no backend needed).
   * Parses meta tags from the raw HTML.
   */
  const fetchMeta = useCallback(async (url: string) => {
    if (!url.trim()) return;
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`;
      const res = await fetch(proxyUrl, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch');
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const getMeta = (name: string) =>
        doc.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
        doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';

      const ogTitle = getMeta('og:title') || doc.title || finalUrl;
      const ogDescription = getMeta('og:description') || getMeta('description') || '';
      const ogImage = getMeta('og:image') || '';
      const hostname = new URL(finalUrl).hostname;
      const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

      updateNodeData(id, { url: finalUrl, ogTitle, ogDescription, ogImage, favicon, hostname });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError('Could not load preview. Check the URL and try again.');
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [id, updateNodeData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fetchMeta(inputUrl);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { url: '', ogTitle: '', ogDescription: '', ogImage: '', favicon: '', hostname: '' });
    setInputUrl('');
    setError('');
  };

  return (
    <BaseNode
      id={id}
      title={nodeData.ogTitle || 'Bookmark'}
      icon={<Bookmark className="h-4 w-4" />}
      selected={selected}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => updateNodeData(id, { collapsed: !nodeData.collapsed })}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      color={nodeData.color}
      nodeType="bookmark"
      bodyClassName="p-3"
    >
      {!hasData ? (
        /* URL input form */
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg border-2 border-border bg-accent/30 px-2 py-1.5">
            <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="https://example.com"
              className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          {error && <p className="text-[10px] text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading || !inputUrl.trim()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            onClick={(e) => e.stopPropagation()}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            {loading ? 'Fetching…' : 'Load Preview'}
          </button>
        </form>
      ) : (
        /* Rich preview card */
        <div className="flex flex-col gap-2">
          {nodeData.ogImage && (
            <div className="relative h-32 w-full overflow-hidden rounded-lg border border-border">
              <img
                src={nodeData.ogImage}
                alt={nodeData.ogTitle}
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {nodeData.favicon && (
                <img src={nodeData.favicon} alt="" className="h-4 w-4 flex-shrink-0 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{nodeData.hostname}</span>
            </div>
            {nodeData.ogDescription && (
              <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">{nodeData.ogDescription}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={nodeData.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex flex-1 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary truncate"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{nodeData.url}</span>
            </a>
            <button
              onClick={handleReset}
              className="rounded-lg border border-border p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Change URL"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

BookmarkNode.displayName = 'BookmarkNode';
