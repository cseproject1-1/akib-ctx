import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { FileText, Upload, Eye, Loader2, Presentation } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { useRef, useState } from 'react';
import { uploadCanvasFile } from '@/lib/r2/storage';
import { PDFViewerModal } from '@/components/canvas/PDFViewerModal';
import { toast } from 'sonner';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.ppt,.pptx';

function getFileType(fileName: string): 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pptx' || ext === 'ppt') return ext as 'ppt' | 'pptx';
  if (ext === 'docx' || ext === 'doc') return ext as 'doc' | 'docx';
  return 'pdf';
}

function getIcon(fileType?: string) {
  if (fileType === 'ppt' || fileType === 'pptx') return <Presentation className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function PDFNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const nodeData = data as any;

  const handleUpload = async (file: File) => {
    if (!workspaceId) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large (max 20MB)');
      return;
    }
    const fileType = getFileType(file.name);
    updateNodeData(id, { uploading: true, fileName: file.name, fileSize: file.size, progress: 0, fileType });

    try {
      const { url, path } = await uploadCanvasFile(workspaceId, file, (pct) => {
        updateNodeData(id, { progress: pct });
      });
      updateNodeData(id, { storageUrl: url, storageKey: path, uploading: false, progress: 100 });
      toast.success('Document uploaded');
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

  const hasFile = !!nodeData.storageUrl;

  return (
    <>
      <BaseNode
        id={id}
        title={nodeData.fileName || 'Upload Document'}
        icon={getIcon(nodeData.fileType)}
        selected={selected}
        onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
        tags={(data as any)?.tags}
        color={(data as any).color}
        headerExtra={
          hasFile ? (
            <button
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); setViewerOpen(true); }}
              title="Preview document"
            >
              <Eye className="h-4 w-4" />
            </button>
          ) : undefined
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="p-3">
          {nodeData.uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${nodeData.progress || 0}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">Uploading…</span>
            </div>
          ) : hasFile ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {getIcon(nodeData.fileType)}
              <span className="truncate">{nodeData.fileName}</span>
              <span>({(nodeData.fileSize / 1024).toFixed(0)} KB)</span>
            </div>
          ) : (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Click to upload document
            </button>
          )}
        </div>
      </BaseNode>

      {viewerOpen && nodeData.storageUrl && (
        <PDFViewerModal
          url={nodeData.storageUrl}
          fileName={nodeData.fileName}
          fileSize={nodeData.fileSize}
          fileType={nodeData.fileType}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
