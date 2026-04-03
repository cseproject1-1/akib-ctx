import { memo, useRef, useState, useCallback, type DragEvent } from 'react';
import { type NodeProps, Handle, Position, NodeResizer } from '@xyflow/react';
import { FileText, Upload, Loader2, Expand, X, Presentation, Sheet, File } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { HANDLE_IDS } from '@/lib/constants/canvas';
import { uploadCanvasFile } from '@/lib/r2/storage';
import { FileViewerModal } from '@/components/canvas/FileViewerModal';
import { toast } from 'sonner';
import { PDFNodeData } from '@/types/canvas';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt';

function getFileType(fileName: string): PDFNodeData['fileType'] {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt'].includes(ext)) {
    return ext as PDFNodeData['fileType'];
  }
  return 'pdf';
}

function getIcon(fileType?: string) {
  switch (fileType) {
    case 'ppt':
    case 'pptx':
      return <Presentation className="h-4 w-4" />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <Sheet className="h-4 w-4" />;
    case 'txt':
      return <File className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const handleBase =
  '!rounded-full !bg-primary/60 !border-2 !border-primary transition-opacity !opacity-0 group-hover/node:!opacity-100';
const handleSelected = '!opacity-100';
const handleSize = '!w-2.5 !h-2.5';

const hoverIcon =
  'absolute z-10 rounded-md bg-background/80 p-1 text-muted-foreground opacity-0 transition-all group-hover/node:opacity-100 hover:bg-background hover:text-foreground shadow-sm backdrop-blur-sm';

export const PDFNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const nodeData = data as unknown as PDFNodeData;

  const handleUpload = useCallback(async (file: File) => {
    if (!workspaceId) return;
    const acceptedExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!acceptedExts.includes(ext)) {
      toast.error('Unsupported file type');
      return;
    }
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
  }, [workspaceId, id, updateNodeData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload, id, updateNodeData]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const hasFile = !!nodeData.storageUrl;
  const isSelected = !!selected;
  const handleClasses = `${handleBase} ${isSelected ? handleSelected : ''} ${handleSize}`;

  return (
    <>
      <div
        className={`group/node relative flex items-center justify-center transition-shadow duration-150 ${
          dragOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
        } ${!hasFile ? '' : 'hover:ring-1 hover:ring-foreground/20'}`}
        onDoubleClick={() => hasFile && setViewerOpen(true)}
        onContextMenu={(e) => {
          e.preventDefault();
          setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id });
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {canvasMode === 'edit' && (
          <NodeResizer
            isVisible={isSelected}
            minWidth={80}
            minHeight={60}
            lineClassName="!border-primary/50"
            handleClassName="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background !rounded-sm"
          />
        )}

        {/* Hover: delete (top-left) */}
        {hasFile && canvasMode === 'edit' && (
          <button
            className={`${hoverIcon} top-1 left-1 hover:!text-destructive`}
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(id);
            }}
            title="Delete file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Hover: expand hint (top-right) */}
        {hasFile && (
          <button
            className={`${hoverIcon} top-1 right-1`}
            onClick={(e) => {
              e.stopPropagation();
              setViewerOpen(true);
            }}
            title="View fullscreen"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Content */}
        <div className="p-3">
          {nodeData.uploading ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${nodeData.progress || 0}%` }}
                />
              </div>
            </div>
          ) : hasFile ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{getIcon(nodeData.fileType)}</span>
              <div className="flex flex-col">
                <span className="max-w-[200px] truncate text-xs font-medium text-foreground">
                  {nodeData.fileName}
                </span>
                {nodeData.fileSize ? (
                  <span className="text-[10px] text-muted-foreground">
                    {formatSize(nodeData.fileSize)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <button
              className="flex h-20 w-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-5 w-5" />
              <span className="text-xs">Upload file</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Connection handles — visible on hover or select */}
        {hasFile && (
          <>
            <Handle type="target" position={Position.Top} id={HANDLE_IDS.TARGET.TOP} className={handleClasses} style={{ left: '50%', transform: 'translateX(-50%)' }} />
            <Handle type="target" position={Position.Bottom} id={HANDLE_IDS.TARGET.BOTTOM} className={handleClasses} style={{ left: '50%', transform: 'translateX(-50%)' }} />
            <Handle type="target" position={Position.Left} id={HANDLE_IDS.TARGET.LEFT} className={handleClasses} style={{ top: '50%', transform: 'translateY(-50%)' }} />
            <Handle type="target" position={Position.Right} id={HANDLE_IDS.TARGET.RIGHT} className={handleClasses} style={{ top: '50%', transform: 'translateY(-50%)' }} />
            <Handle type="source" position={Position.Top} id={HANDLE_IDS.SOURCE.TOP} className={handleClasses} style={{ left: '50%', transform: 'translateX(-50%)' }} />
            <Handle type="source" position={Position.Bottom} id={HANDLE_IDS.SOURCE.BOTTOM} className={handleClasses} style={{ left: '50%', transform: 'translateX(-50%)' }} />
            <Handle type="source" position={Position.Left} id={HANDLE_IDS.SOURCE.LEFT} className={handleClasses} style={{ top: '50%', transform: 'translateY(-50%)' }} />
            <Handle type="source" position={Position.Right} id={HANDLE_IDS.SOURCE.RIGHT} className={handleClasses} style={{ top: '50%', transform: 'translateY(-50%)' }} />
          </>
        )}
      </div>

      {viewerOpen && nodeData.storageUrl && (
        <FileViewerModal
          url={nodeData.storageUrl}
          fileName={nodeData.fileName || 'document'}
          fileSize={nodeData.fileSize || 0}
          fileType={nodeData.fileType}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
});

PDFNode.displayName = 'PDFNode';
