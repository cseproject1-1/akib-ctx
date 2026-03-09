import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Video, ExternalLink, X, Play, Expand } from 'lucide-react';

function extractVideoEmbed(url: string): { type: 'youtube' | 'vimeo' | 'unknown'; embedUrl: string } | null {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0` };

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };

  return null;
}

export const VideoNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const d = data as { url?: string; title?: string; locked?: boolean };
  const [inputUrl, setInputUrl] = useState(d.url || '');
  const [editing, setEditing] = useState(!d.url);

  const handleSubmit = useCallback(() => {
    let url = inputUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const embed = extractVideoEmbed(url);
    updateNodeData(id, { url, title: d.title || (embed?.type === 'youtube' ? 'YouTube Video' : embed?.type === 'vimeo' ? 'Vimeo Video' : 'Video') });
    setEditing(false);
  }, [id, inputUrl, d.title, updateNodeData]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { url: '', title: '' });
    setInputUrl('');
    setEditing(true);
  }, [id, updateNodeData]);

  const embed = d.url ? extractVideoEmbed(d.url) : null;

  return (
    <div
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-xl border-2 bg-card transition-shadow ${
        selected ? 'border-primary shadow-[4px_4px_0px_hsl(var(--primary)/0.3)]' : 'border-border shadow-[var(--brutal-shadow)]'
      }`}
    >
      <div className="flex items-center gap-2 border-b-2 border-border px-3 py-2 cursor-grab active:cursor-grabbing">
        <Video className="h-4 w-4 text-red" />
        <span className="flex-1 truncate text-xs font-bold uppercase tracking-wider text-foreground">
          {d.title || 'Video'}
        </span>
        {d.url && (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setExpandedNode(id); }} className="rounded p-0.5 text-muted-foreground hover:text-primary" title="Fullscreen">
              <Expand className="h-3.5 w-3.5" />
            </button>
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="rounded p-0.5 text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {!d.locked && canvasMode === 'edit' && (
              <button onClick={handleClear} className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" onClick={(e) => e.stopPropagation()}>
        {editing || !d.url ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
            <Play className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">YouTube or Vimeo URL</p>
            <input
              className="w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              placeholder="https://youtube.com/watch?v=..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSubmit(); }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <button onClick={handleSubmit} className="brutal-btn rounded-lg bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              Embed
            </button>
          </div>
        ) : embed ? (
          <iframe
            src={embed.embedUrl}
            title={d.title || 'Video'}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-xs text-muted-foreground">Unsupported video URL</p>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="!-top-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Bottom} className="!-bottom-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="target" position={Position.Left} className="!-left-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Right} className="!-right-1.5 !opacity-0 group-hover:!opacity-100" />
    </div>
  );
});

VideoNode.displayName = 'VideoNode';
