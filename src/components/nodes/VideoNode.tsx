import { memo, useState, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Video, ExternalLink, X, Play, Expand } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { VideoNodeData } from '@/types/canvas';

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
  const nodeData = data as unknown as VideoNodeData;
  const [inputUrl, setInputUrl] = useState(nodeData.url || '');
  const [editing, setEditing] = useState(!nodeData.url);

  const handleSubmit = useCallback(() => {
    let url = inputUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const embed = extractVideoEmbed(url);
    updateNodeData(id, { url, title: nodeData.title || (embed?.type === 'youtube' ? 'YouTube Video' : embed?.type === 'vimeo' ? 'Vimeo Video' : 'Video') });
    setEditing(false);
  }, [id, inputUrl, nodeData.title, updateNodeData]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { url: '', title: '' });
    setInputUrl('');
    setEditing(true);
  }, [id, updateNodeData]);

  const embed = nodeData.url ? extractVideoEmbed(nodeData.url) : null;

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Video'}
      icon={<Video className="h-4 w-4 text-red" />}
      selected={selected}
      onTitleChange={(t) => updateNodeData(id, { title: t })}
      bodyClassName="p-0 aspect-video flex-1"
      onMenuClick={(e) => useCanvasStore.getState().setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => updateNodeData(id, { collapsed: !nodeData.collapsed })}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      color={nodeData.color}
      nodeType="video"
      headerExtra={
        nodeData.url && (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setExpandedNode(id); }} className="rounded p-0.5 text-muted-foreground hover:text-primary" title="Fullscreen">
              <Expand className="h-3.5 w-3.5" />
            </button>
            <a href={nodeData.url} target="_blank" rel="noopener noreferrer" className="rounded p-0.5 text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {!nodeData.locked && canvasMode === 'edit' && (
              <button onClick={handleClear} className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      }
    >
      <div className="flex-1 w-full h-full" onClick={(e) => e.stopPropagation()}>
        {editing || !nodeData.url ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 bg-muted/20">
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
            title={nodeData.title || 'Video'}
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
    </BaseNode>
  );
});

VideoNode.displayName = 'VideoNode';

VideoNode.displayName = 'VideoNode';
