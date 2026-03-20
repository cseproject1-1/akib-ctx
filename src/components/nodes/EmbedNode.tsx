import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Globe, ExternalLink, X, Expand, Loader2 } from 'lucide-react';
import { WORKER_URL } from '@/lib/firebase/client';
import { EmbedNodeData } from '@/types/canvas';

interface UrlMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  domain: string;
}

/** Convert known embeddable sites to their embed URLs */
function getEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  // Google Docs
  if (/docs\.google\.com\/(document|spreadsheets|presentation)\/d\//.test(url)) {
    if (url.includes('/edit')) return url.replace(/\/edit.*$/, '/preview');
    if (!url.includes('/preview') && !url.includes('/embed')) return url.replace(/\/?$/, '/preview');
    return url;
  }

  // Figma
  if (/figma\.com\/(file|design|proto)\//.test(url)) {
    return `https://www.figma.com/embed?embed_host=lovable&url=${encodeURIComponent(url)}`;
  }

  // CodePen
  const codepenMatch = url.match(/codepen\.io\/([^/]+)\/pen\/([^/?]+)/);
  if (codepenMatch) return `https://codepen.io/${codepenMatch[1]}/embed/${codepenMatch[2]}?default-tab=result`;

  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

  // Spotify (track, album, playlist, episode, show)
  const spotifyMatch = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) return `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}`;

  // SoundCloud — use their oEmbed widget URL
  if (/soundcloud\.com\/[^/]+\/[^/]+/.test(url)) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
  }

  // Twitter/X — single tweet embed
  const tweetMatch = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
  if (tweetMatch) return `https://platform.twitter.com/embed/Tweet.html?id=${tweetMatch[1]}&theme=dark`;

  // Google Maps — already an embed link
  if (/google\.com\/maps\/embed/.test(url)) return url;
  // Google Maps — place or directions link → convert to embed
  if (/google\.(com|[a-z]{2,3})\/maps/.test(url)) {
    return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d0!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z!5e0!3m2!1sen!2sus!4v1&q=${encodeURIComponent(url)}`;
  }
  // Google Maps shortlink
  if (/maps\.app\.goo\.gl/.test(url) || /goo\.gl\/maps/.test(url)) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
  }

  // Notion — public pages
  if (/notion\.so\//.test(url) || /notion\.site\//.test(url)) {
    // Notion public pages can be embedded directly
    return url;
  }

  return null;
}

/** Check if this URL is from a known embeddable provider */
function isKnownEmbeddable(url: string): boolean {
  return getEmbedUrl(url) !== null;
}

export const EmbedNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const nodeData = data as unknown as EmbedNodeData;
  const [inputUrl, setInputUrl] = useState(nodeData.url || '');
  const [editing, setEditing] = useState(!nodeData.url);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [metadata, setMetadata] = useState<UrlMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const iframeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeLoadedRef = useRef(false);

  const handleSubmit = useCallback(() => {
    let url = inputUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    updateNodeData(id, { url, title: nodeData.title || url });
    setEditing(false);
    setIframeFailed(false);
    setMetadata(null);
    iframeLoadedRef.current = false;
  }, [id, inputUrl, nodeData.title, updateNodeData]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { url: '', title: '' });
    setInputUrl('');
    setEditing(true);
    setIframeFailed(false);
    setMetadata(null);
  }, [id, updateNodeData]);

  // Fetch metadata when iframe fails
  const fetchMetadata = useCallback(async (url: string) => {
    setLoadingMeta(true);
    try {
      const response = await fetch(`${WORKER_URL}/api/urlMetadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!response.ok) throw new Error(`API error ${response.status}`);
      const result = await response.json() as UrlMetadata;
      if (result) {
        setMetadata(result);
      } else {
        // Minimal fallback
        try {
          const domain = new URL(url).hostname;
          setMetadata({
            title: domain,
            description: null,
            image: null,
            favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
            domain,
          });
        } catch { /* ignore */ }
      }
    } catch {
      try {
        const domain = new URL(url).hostname;
        setMetadata({
          title: domain,
          description: null,
          image: null,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
          domain,
        });
      } catch { /* ignore */ }
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  // Timer to detect iframe blocking for non-known-embeddable URLs
  useEffect(() => {
    if (!nodeData.url || editing || isKnownEmbeddable(nodeData.url)) return;

    iframeLoadedRef.current = false;
    setIframeFailed(false);

    iframeTimerRef.current = setTimeout(() => {
      if (!iframeLoadedRef.current) {
        setIframeFailed(true);
        fetchMetadata(nodeData.url!);
      }
    }, 4000);

    return () => {
      if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
    };
  }, [nodeData.url, editing, fetchMetadata]);

  const handleIframeLoad = useCallback(() => {
    iframeLoadedRef.current = true;
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
    setIframeFailed(false);
  }, []);

  const handleIframeError = useCallback(() => {
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
    setIframeFailed(true);
    if (nodeData.url) fetchMetadata(nodeData.url);
  }, [nodeData.url, fetchMetadata]);

  const embedUrl = nodeData.url ? getEmbedUrl(nodeData.url) : null;
  const finalIframeSrc = (embedUrl || nodeData.url) ?? '';

  return (
    <div
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow animate-node-appear ${selected ? 'border-primary shadow-[var(--clay-shadow-md)]' : 'border-border shadow-[var(--clay-shadow-sm)]'
        }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 cursor-grab active:cursor-grabbing">
        <Globe className="h-4 w-4 text-cyan" />
        <span className="flex-1 truncate text-xs font-bold uppercase tracking-wider text-foreground">
          {nodeData.url ? (nodeData.title || 'Embed') : 'Embed URL'}
        </span>
        {nodeData.url && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setExpandedNode(id); }}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-primary"
              title="Fullscreen"
            >
              <Expand className="h-3.5 w-3.5" />
            </button>
            <a
              href={nodeData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {!nodeData.locked && canvasMode === 'edit' && (
              <button
                onClick={handleClear}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1" onClick={(e) => e.stopPropagation()}>
        {editing || !nodeData.url ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
            <Globe className="h-8 w-8 text-muted-foreground" />
            <input
              className="w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
              placeholder="https://example.com"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSubmit(); }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <button
              onClick={handleSubmit}
              className="brutal-btn rounded-lg bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Embed
            </button>
          </div>
        ) : iframeFailed ? (
          /* Link Preview Fallback */
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
            {loadingMeta ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : metadata ? (
              <div className="flex w-full flex-col gap-3 overflow-hidden">
                {metadata.image && (
                  <div className="w-full overflow-hidden rounded-lg border-2 border-border">
                    <img
                      src={metadata.image}
                      alt={metadata.title || ''}
                      className="h-28 w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <img
                    src={metadata.favicon || `https://www.google.com/s2/favicons?domain=${metadata.domain}&sz=64`}
                    alt=""
                    className="h-5 w-5 rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-xs text-muted-foreground">{metadata.domain}</span>
                </div>
                <h4 className="text-sm font-bold text-foreground line-clamp-2">{metadata.title}</h4>
                {metadata.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{metadata.description}</p>
                )}
                <a
                  href={nodeData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center justify-center gap-2 rounded-lg border-2 border-border bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Open in New Tab
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className="text-center text-[10px] text-muted-foreground">
                  This site doesn't allow embedding
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Globe className="h-8 w-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Could not embed this site</p>
                <a
                  href={nodeData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border-2 border-border bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Open in New Tab
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        ) : (
          <iframe
            src={finalIframeSrc}
            title={nodeData.title || 'Embedded content'}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}
      </div>

      <Handle type="target" position={Position.Top} className="!-top-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Bottom} className="!-bottom-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="target" position={Position.Left} className="!-left-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Right} className="!-right-1.5 !opacity-0 group-hover:!opacity-100" />
    </div>
  );
});

EmbedNode.displayName = 'EmbedNode';
