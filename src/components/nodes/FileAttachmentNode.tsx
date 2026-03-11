import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { BaseNode } from './BaseNode';
import { Paperclip, Upload, X, FileText, FileImage, FileArchive, FileCode, FileAudio, FileVideo, Download, Loader2 } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

interface AttachedFile {
  id: string;
  name: string;
  size: number; // bytes
  type: string; // MIME
  url: string;  // object URL or R2 URL
}

/** Return a suitable icon for the file MIME type */
function FileIcon({ type, className }: { type: string; className?: string }) {
  if (type.startsWith('image/'))       return <FileImage className={className} />;
  if (type.startsWith('audio/'))       return <FileAudio className={className} />;
  if (type.startsWith('video/'))       return <FileVideo className={className} />;
  if (type.includes('zip') || type.includes('tar') || type.includes('gz')) return <FileArchive className={className} />;
  if (type.includes('javascript') || type.includes('json') || type.includes('html') || type.includes('css')) return <FileCode className={className} />;
  return <FileText className={className} />;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * @component FileAttachmentNode
 * @description Drag-and-drop file attachment node. Stores files as object URLs locally.
 * Files can be downloaded by clicking the download button.
 * @param {NodeProps} props - React Flow node props
 */
export function FileAttachmentNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as any;

  const files: AttachedFile[] = nodeData.files || [];
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setFiles = useCallback(
    (f: AttachedFile[]) => updateNodeData(id, { files: f }),
    [id, updateNodeData]
  );

  const processFiles = async (fileList: FileList) => {
    setUploading(true);
    const newFiles: AttachedFile[] = [];
    for (const f of Array.from(fileList)) {
      // Create an object URL for local use
      const url = URL.createObjectURL(f);
      newFiles.push({ id: crypto.randomUUID(), name: f.name, size: f.size, type: f.type || 'application/octet-stream', url });
    }
    setFiles([...files, ...newFiles]);
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };

  const removeFile = (fileId: string) => {
    const f = files.find((f) => f.id === fileId);
    if (f?.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
    setFiles(files.filter((f) => f.id !== fileId));
  };

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Files'}
      icon={<Paperclip className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(t) => updateNodeData(id, { title: t })}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => updateNodeData(id, { collapsed: !nodeData.collapsed })}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      color={nodeData.color}
      nodeType="fileAttachment"
      bodyClassName="p-2"
      footerStats={files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : undefined}
    >
      <div className="flex flex-col gap-2 min-w-[240px]">
        {/* Drop zone */}
        <div
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }}
          onDrop={handleDrop}
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed cursor-pointer transition-all py-3 ${
            dragging
              ? 'border-primary bg-primary/10 scale-[1.02]'
              : 'border-border bg-accent/20 hover:border-primary/50 hover:bg-accent/40'
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Upload className={`h-5 w-5 ${dragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
          )}
          <span className="text-[10px] font-semibold text-muted-foreground">
            {dragging ? 'Drop files here' : 'Drag files or click to browse'}
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) processFiles(e.target.files); }}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="flex flex-col gap-1">
            {files.map((f) => (
              <div key={f.id} className="group/file flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 transition-all hover:border-primary/40 hover:shadow-sm">
                <FileIcon type={f.type} className="h-4 w-4 flex-shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                  <p className="text-[9px] text-muted-foreground">{formatBytes(f.size)}</p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity">
                  <a
                    href={f.url}
                    download={f.name}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded p-0.5 text-muted-foreground hover:text-primary"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="rounded p-0.5 text-muted-foreground hover:text-destructive" title="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
