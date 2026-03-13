import { type NodeProps, useReactFlow } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { ImagePlus, Upload, Loader2, Maximize2 } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { useRef, useState } from 'react';
import { uploadCanvasFile } from '@/lib/r2/storage';
import { ImageLightboxModal } from '@/components/canvas/ImageLightboxModal';
import { toast } from 'sonner';
import { ImageNodeData } from '@/types/canvas';

export function ImageNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showResize, setShowResize] = useState(false);
  const nodeData = data as unknown as ImageNodeData;
  const reactFlow = useReactFlow();

  const handleUpload = async (file: File) => {
    if (!workspaceId) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large (max 20MB)');
      return;
    }
    updateNodeData(id, { uploading: true, altText: file.name, progress: 0 });

    try {
      const { url, path } = await uploadCanvasFile(workspaceId, file, (pct) => {
        updateNodeData(id, { progress: pct });
      });
      updateNodeData(id, { storageUrl: url, storageKey: path, uploading: false, progress: 100 });
      toast.success('Image uploaded');
    } catch {
      updateNodeData(id, { uploading: false, progress: 0 });
      toast.error('Upload failed');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const currentNode = reactFlow.getNode(id);
  const nodeWidth = currentNode?.measured?.width ?? currentNode?.style?.width ?? 320;
  const nodeHeight = currentNode?.measured?.height ?? currentNode?.style?.height ?? 280;

  const handleManualResize = (w: number, h: number) => {
    reactFlow.setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id ? { ...n, style: { ...n.style, width: w, height: h } } : n
      )
    );
  };

  const hasImage = !!nodeData.storageUrl;

  return (
    <>
      <BaseNode
        id={id}
        title={nodeData.altText || 'Upload Image'}
        icon={<ImagePlus className="h-4 w-4" />}
        selected={selected}
        onTitleChange={(v) => updateNodeData(id, { altText: v })}
        onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
        tags={nodeData.tags}
        color={nodeData.color}
        headerExtra={
          hasImage ? (
            <button
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); setShowResize((v) => !v); }}
              title="Manual resize"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          ) : undefined
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {/* Manual resize controls */}
        {showResize && hasImage && (
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 text-xs text-muted-foreground">
            <label className="flex items-center gap-1">
              W
              <input
                type="number"
                className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-primary"
                value={Math.round(Number(nodeWidth))}
                min={120}
                max={1200}
                onChange={(e) => handleManualResize(Number(e.target.value) || 120, Number(nodeHeight))}
                onClick={(e) => e.stopPropagation()}
              />
            </label>
            <span className="text-muted-foreground">×</span>
            <label className="flex items-center gap-1">
              H
              <input
                type="number"
                className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-primary"
                value={Math.round(Number(nodeHeight))}
                min={80}
                max={1200}
                onChange={(e) => handleManualResize(Number(nodeWidth), Number(e.target.value) || 80)}
                onClick={(e) => e.stopPropagation()}
              />
            </label>
            <span className="ml-auto text-[10px]">px</span>
          </div>
        )}
        <div className="p-1">
          {nodeData.uploading ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="h-1.5 w-3/4 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${nodeData.progress || 0}%` }}
                />
              </div>
            </div>
          ) : hasImage ? (
            <img
              src={nodeData.storageUrl}
              alt={nodeData.altText || 'Image'}
              className="w-full cursor-pointer rounded-b-[8px] object-cover"
              onClick={() => setLightboxOpen(true)}
              style={{ maxHeight: 400 }}
            />
          ) : (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Click to upload image
            </button>
          )}
        </div>
      </BaseNode>

      {lightboxOpen && nodeData.storageUrl && (
        <ImageLightboxModal
          url={nodeData.storageUrl}
          alt={nodeData.altText}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
