import { memo, useState, useRef, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { toast } from 'sonner';
import { BaseNode } from './BaseNode';
import { Paperclip, Upload, X, FileText, FileImage, FileArchive, FileCode, FileAudio, FileVideo, Download, Loader2, Cloud, ExternalLink, Folder, FolderOpen, Tag, MoreVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { uploadCanvasFile } from '@/lib/r2/storage';
import { FileAttachmentNodeData, AttachedFile } from '@/types/canvas';
import { getGoogleDriveAuthUrl, isGoogleDriveConfigured } from '@/lib/googleDrive/service';

// File categories for organization
const FILE_CATEGORIES = [
  'Documents',
  'Images',
  'Videos',
  'Audio',
  'Archives',
  'Code',
  'Data',
  'Other'
] as const;

// AttachedFile interface is now imported from types/canvas

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
export const FileAttachmentNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as FileAttachmentNodeData;

  const files = nodeData.files || [];
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const setFiles = useCallback(
    (f: AttachedFile[]) => updateNodeData(id, { files: f }),
    [id, updateNodeData]
  );

  const processFiles = async (fileList: FileList) => {
    setUploading(true);
    const currentWorkspaceId = useCanvasStore.getState().workspaceId;

    try {
      const newFiles: AttachedFile[] = [];
      for (const f of Array.from(fileList)) {
        if (!currentWorkspaceId) {
          toast.error('No active workspace found. Please select a workspace first.');
          break;
        }
        
        // Upload to R2
        toast.loading(`Uploading ${f.name}...`, { id: `upload-${f.name}` });
        const { url, path } = await uploadCanvasFile(currentWorkspaceId, f);
        toast.success(`Uploaded ${f.name}`, { id: `upload-${f.name}` });
        
        newFiles.push({ 
          id: crypto.randomUUID(), 
          name: f.name, 
          size: f.size, 
          type: f.type || 'application/octet-stream', 
          url,
          path // Store the path for deletion
        });
      }
      setFiles([...files as unknown as AttachedFile[], ...newFiles]);
    } catch (error) {
      console.error('Failed to upload files:', error);
      toast.error('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };

  const removeFile = (fileId: string) => {
    const filesTyped = files as unknown as AttachedFile[];
    const f = filesTyped.find((f) => f.id === fileId);
    if (f?.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
    setFiles(filesTyped.filter((f) => f.id !== fileId));
  };

  const handleConnectGoogleDrive = async () => {
    if (!isGoogleDriveConfigured()) {
      toast.error('Google Drive integration is not configured. Please check environment variables.');
      return;
    }
    
    try {
      const authUrl = getGoogleDriveAuthUrl();
      // Open in new window for OAuth flow
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const authWindow = window.open(
        authUrl,
        'GoogleDriveAuth',
        `width=${width},height=${height},top=${top},left=${left}`
      );
      
      // Note: In a real implementation, you would handle the OAuth callback
      // and store the access token securely. For this demo, we'll show a message.
      toast.info('Google Drive authentication window opened. Complete the OAuth flow to connect your account.');
    } catch (error) {
      console.error('Failed to connect Google Drive:', error);
      toast.error('Failed to connect to Google Drive');
    }
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
        
        {/* Google Drive connection button */}
        {isGoogleDriveConfigured() && (
          <button
            onClick={(e) => { e.stopPropagation(); handleConnectGoogleDrive(); }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-accent/10 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/50 hover:bg-accent/20 hover:text-primary"
          >
            <Cloud className="h-4 w-4" />
            Connect Google Drive
          </button>
        )}

        {/* Category filter */}
        {files.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Filter:</span>
            {['All', ...FILE_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); }}
                className={`text-[10px] px-1.5 py-0.5 rounded ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* File list with categorization */}
        {files.length > 0 && (
          <div className="flex flex-col gap-1">
            {(files as unknown as AttachedFile[])
              .filter(f => selectedCategory === 'All' || (f.category || 'Other') === selectedCategory)
              .map((f) => {
                const category = f.category || 'Other';
                return (
                  <div key={f.id} className="group/file flex flex-col gap-1 rounded-lg border border-border bg-card px-2 py-1.5 transition-all hover:border-primary/40 hover:shadow-sm">
                    <div className="flex items-center gap-2">
                      {f.storageType === 'google_drive' ? (
                        <Cloud className="h-4 w-4 flex-shrink-0 text-primary" />
                      ) : (
                        <FileIcon type={f.type} className="h-4 w-4 flex-shrink-0 text-primary" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground">{formatBytes(f.size)}</span>
                          <span className="text-[9px] px-1 rounded bg-muted text-muted-foreground">{category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity">
                        <a
                          href={f.url}
                          {...(f.storageType === 'google_drive' ? { target: '_blank', rel: 'noopener noreferrer' } : { download: f.name })}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded p-0.5 text-muted-foreground hover:text-primary"
                          title={f.storageType === 'google_drive' ? 'Open in Google Drive' : 'Download/View'}
                        >
                          {f.storageType === 'google_drive' ? (
                            <ExternalLink className="h-3.5 w-3.5" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </a>
                        <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="rounded p-0.5 text-muted-foreground hover:text-destructive" title="Remove">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Tags for file */}
                    {f.tags && f.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-6">
                        {f.tags.map((tag, index) => (
                          <span key={index} className="text-[8px] px-1 rounded bg-primary/10 text-primary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </BaseNode>
  );
});

FileAttachmentNode.displayName = 'FileAttachmentNode';
