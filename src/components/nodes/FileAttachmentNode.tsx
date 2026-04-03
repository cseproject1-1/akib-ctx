import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { toast } from 'sonner';
import { BaseNode } from './BaseNode';
import {
  Paperclip, Upload, X, FileText, FileImage, FileArchive, FileCode,
  FileAudio, FileVideo, Download, Loader2, Cloud, ExternalLink,
  ChevronDown, ChevronUp, Eye, EyeOff, ZoomIn, ZoomOut, Code2,
} from 'lucide-react';
import { uploadCanvasFile } from '@/lib/r2/storage';
import { FileAttachmentNodeData, AttachedFile } from '@/types/canvas';
import { getGoogleDriveAuthUrl, isGoogleDriveConfigured } from '@/lib/googleDrive/service';

// ─── File Categories ──────────────────────────────────────────────────────────
const FILE_CATEGORIES = ['Documents', 'Images', 'Videos', 'Audio', 'Archives', 'Code', 'Data', 'Other'] as const;

// ─── Allowed MIME types (must mirror storage.ts) ─────────────────────────────
const ALLOWED_EXTENSIONS = ['txt', 'html', 'htm', 'pdf', 'csv', 'json', 'md', 'xml'];

// ─── Icon helper ─────────────────────────────────────────────────────────────
function FileIcon({ type, name, className }: { type: string; name: string; className?: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (type.startsWith('image/'))        return <FileImage className={className} />;
  if (type.startsWith('audio/'))        return <FileAudio className={className} />;
  if (type.startsWith('video/'))        return <FileVideo className={className} />;
  if (type.includes('zip') || type.includes('tar') || type.includes('gz') || ext === 'zip' || ext === 'tar' || ext === 'gz')
    return <FileArchive className={className} />;
  if (type.includes('javascript') || type.includes('json') || type.includes('html') || type.includes('css') || ext === 'html' || ext === 'htm' || ext === 'js' || ext === 'ts' || ext === 'json' || ext === 'css')
    return <FileCode className={className} />;
  if (type === 'text/plain' || ext === 'txt' || ext === 'md')
    return <FileText className={className} />;
  return <FileText className={className} />;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Determine if a file is previewable inline (txt or html) */
function isTextFile(type: string, name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return type === 'text/plain' || type === 'text/markdown' || ext === 'txt' || ext === 'md' || ext === 'log' || ext === 'csv';
}

function isHtmlFile(type: string, name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return type === 'text/html' || ext === 'html' || ext === 'htm';
}

// ─── Per-file upload progress tracker ────────────────────────────────────────
interface UploadingFile {
  name: string;
  progress: number; // 0–100
  error?: string;
}

// ─── Inline TXT viewer ───────────────────────────────────────────────────────
const TxtViewer = memo(({ url, name }: { url: string; name: string }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(11);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    setContent(null);

    fetch(url, { signal: ac.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => { if (!ac.signal.aborted) { setContent(text); setLoading(false); } })
      .catch(err => { if (!ac.signal.aborted) { setError(err.message); setLoading(false); } });

    return () => ac.abort();
  }, [url]);

  if (loading) return <div className="flex items-center justify-center p-4 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin mr-1" />Loading…</div>;
  if (error) return <div className="p-2 text-xs text-destructive">Failed to load: {error}</div>;

  const lines = (content || '').split('\n');

  return (
    <div className="flex flex-col gap-1">
      {/* Controls */}
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={e => { e.stopPropagation(); setFontSize(s => Math.max(8, s - 1)); }}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Decrease font size"
        >
          <ZoomOut className="h-3 w-3" />
        </button>
        <span className="text-[9px] text-muted-foreground w-6 text-center">{fontSize}px</span>
        <button
          onClick={e => { e.stopPropagation(); setFontSize(s => Math.min(20, s + 1)); }}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Increase font size"
        >
          <ZoomIn className="h-3 w-3" />
        </button>
      </div>

      {/* Content */}
      <div
        className="rounded-lg border border-border bg-[#0d1117] overflow-auto"
        style={{ maxHeight: 300, fontFamily: "'Fira Code', 'Consolas', monospace", fontSize }}
        onClick={e => e.stopPropagation()}
      >
        <table className="border-collapse w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-white/5">
                <td
                  className="select-none pr-3 pl-2 text-right text-[10px] border-r border-white/10"
                  style={{ color: '#6e7681', minWidth: 32 }}
                >
                  {i + 1}
                </td>
                <td className="pl-3 pr-2 text-[#e6edf3] whitespace-pre">
                  {line || '\u00a0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[9px] text-muted-foreground text-right">
        {lines.length} lines · {formatBytes((content || '').length)}
      </div>
    </div>
  );
});
TxtViewer.displayName = 'TxtViewer';

// ─── Inline HTML viewer ──────────────────────────────────────────────────────
const HtmlViewer = memo(({ url, name }: { url: string; name: string }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const [viewHeight, setViewHeight] = useState(250);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    setHtml(null);

    fetch(url, { signal: ac.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => { if (!ac.signal.aborted) { setHtml(text); setLoading(false); } })
      .catch(err => { if (!ac.signal.aborted) { setError(err.message); setLoading(false); } });

    return () => ac.abort();
  }, [url]);

  if (loading) return <div className="flex items-center justify-center p-4 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin mr-1" />Loading…</div>;
  if (error) return <div className="p-2 text-xs text-destructive">Failed to load: {error}</div>;

  return (
    <div className="flex flex-col gap-1">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); setMode('preview'); }}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${mode === 'preview' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            Preview
          </button>
          <button
            onClick={e => { e.stopPropagation(); setMode('source'); }}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${mode === 'source' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            <Code2 className="h-2.5 w-2.5 inline mr-0.5" />Source
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); setViewHeight(h => Math.max(120, h - 60)); }}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Less height"
          ><ZoomOut className="h-3 w-3" /></button>
          <button
            onClick={e => { e.stopPropagation(); setViewHeight(h => Math.min(600, h + 60)); }}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            title="More height"
          ><ZoomIn className="h-3 w-3" /></button>
        </div>
      </div>

      {/* Content area */}
      {mode === 'preview' ? (
        <iframe
          srcDoc={html || ''}
          sandbox="allow-same-origin"
          title={`Preview: ${name}`}
          className="rounded-lg border border-border bg-white"
          style={{ width: '100%', height: viewHeight, display: 'block' }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div
          className="rounded-lg border border-border bg-[#0d1117] overflow-auto"
          style={{ maxHeight: viewHeight, fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 10 }}
          onClick={e => e.stopPropagation()}
        >
          <pre className="p-3 text-[#e6edf3] whitespace-pre-wrap break-all leading-relaxed">
            {html}
          </pre>
        </div>
      )}
    </div>
  );
});
HtmlViewer.displayName = 'HtmlViewer';

// ─── Per-file upload progress bar ────────────────────────────────────────────
const ProgressBar = memo(({ name, progress, error }: UploadingFile) => (
  <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-2 py-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-medium text-foreground truncate max-w-[160px]">{name}</span>
      <span className={`text-[9px] ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
        {error ? 'Failed' : progress < 100 ? `${progress}%` : 'Done'}
      </span>
    </div>
    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-200 ${error ? 'bg-destructive' : progress === 100 ? 'bg-green-500' : 'bg-primary'}`}
        style={{ width: `${error ? 100 : progress}%` }}
      />
    </div>
  </div>
));
ProgressBar.displayName = 'ProgressBar';

// ─── Main Component ───────────────────────────────────────────────────────────
/**
 * @component FileAttachmentNode
 * @description Drag-and-drop file node with parallel upload, per-file progress bars,
 * inline TXT viewer (with line numbers), and sandboxed HTML preview/source viewer.
 * @param {NodeProps} props - React Flow node props
 */
export const FileAttachmentNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as FileAttachmentNodeData;

  const files = (nodeData.files || []) as AttachedFile[];
  const [dragging, setDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0); // counter-based drag leave fix

  const setFiles = useCallback(
    (f: AttachedFile[]) => updateNodeData(id, { files: f }),
    [id, updateNodeData]
  );

  /**
   * @function processFiles
   * @description Uploads all files in PARALLEL (not sequential) for maximum speed.
   * Each file gets its own progress bar updated via callback.
   * Images are compressed before upload (in storage.ts).
   * O(n) parallel fetch — limited only by browser connection pool.
   */
  const processFiles = useCallback(async (fileList: FileList) => {
    const currentWorkspaceId = useCanvasStore.getState().workspaceId;
    if (!currentWorkspaceId) {
      toast.error('No active workspace. Please open a workspace first.');
      return;
    }

    const fileArray = Array.from(fileList);

    // Initialise progress slots for each file
    const initialQueue: UploadingFile[] = fileArray.map(f => ({ name: f.name, progress: 0 }));
    setUploadQueue(initialQueue);

    // Build parallel upload promises
    const uploadPromises = fileArray.map((f, idx) => {
      const updateProgress = (pct: number) => {
        setUploadQueue(prev =>
          prev.map((item, i) => i === idx ? { ...item, progress: pct } : item)
        );
      };

      return uploadCanvasFile(currentWorkspaceId, f, updateProgress)
        .then(({ url, path }) => {
          updateProgress(100);
          const ext = f.name.split('.').pop()?.toLowerCase() || '';
          return {
            id: crypto.randomUUID(),
            name: f.name,
            size: f.size,
            type: f.type || (ALLOWED_EXTENSIONS.includes(ext) ? `text/${ext}` : 'application/octet-stream'),
            url,
            path,
            storageType: 'r2' as const,
          } as AttachedFile;
        })
        .catch(err => {
          setUploadQueue(prev =>
            prev.map((item, i) => i === idx ? { ...item, error: err.message } : item)
          );
          console.error(`[Upload] Failed for ${f.name}:`, err);
          return null;
        });
    });

    // All uploads run in parallel — resolved array preserves order
    const results = await Promise.all(uploadPromises);
    const succeeded = results.filter((r): r is AttachedFile => r !== null);

    if (succeeded.length > 0) {
      setFiles([...files, ...succeeded]);
      toast.success(`Uploaded ${succeeded.length} file${succeeded.length !== 1 ? 's' : ''}`);
    }
    if (results.length - succeeded.length > 0) {
      toast.error(`${results.length - succeeded.length} file(s) failed to upload`);
    }

    // Keep progress visible briefly then clear
    setTimeout(() => setUploadQueue([]), 2000);
  }, [files, setFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    const f = files.find(f => f.id === fileId);
    if (f?.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
    setFiles(files.filter(f => f.id !== fileId));
    if (previewFileId === fileId) setPreviewFileId(null);
  }, [files, setFiles, previewFileId]);

  const togglePreview = useCallback((fileId: string) => {
    setPreviewFileId(prev => prev === fileId ? null : fileId);
  }, []);

  const handleConnectGoogleDrive = async () => {
    if (!isGoogleDriveConfigured()) {
      toast.error('Google Drive integration is not configured.');
      return;
    }
    try {
      const authUrl = getGoogleDriveAuthUrl();
      window.open(authUrl, 'GoogleDriveAuth', 'width=500,height=600');
      toast.info('Complete the Google OAuth flow in the popup window.');
    } catch {
      toast.error('Failed to connect to Google Drive');
    }
  };

  const isUploading = uploadQueue.length > 0;
  const filteredFiles = files.filter(f =>
    selectedCategory === 'All' || (f.category || 'Other') === selectedCategory
  );

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
      <div className="flex flex-col gap-2 min-w-[260px]">

        {/* ─── Drop Zone ─────────────────────────────────────────────────────── */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={(e) => { e.stopPropagation(); if (!isUploading) inputRef.current?.click(); }}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed cursor-pointer transition-all py-3 select-none ${
            dragging
              ? 'border-primary bg-primary/10 scale-[1.02]'
              : isUploading
              ? 'border-border bg-accent/10 cursor-not-allowed'
              : 'border-border bg-accent/20 hover:border-primary/50 hover:bg-accent/40'
          }`}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Upload className={`h-5 w-5 ${dragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
          )}
          <span className="text-[10px] font-semibold text-muted-foreground">
            {isUploading
              ? `Uploading ${uploadQueue.length} file${uploadQueue.length !== 1 ? 's' : ''}…`
              : dragging ? 'Drop files here' : 'Drag files or click to browse'}
          </span>
          <span className="text-[9px] text-muted-foreground/60">
            TXT · HTML · PDF · Images · and more
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) { processFiles(e.target.files); e.target.value = ''; } }}
          />
        </div>

        {/* ─── Per-file Upload Progress ───────────────────────────────────────── */}
        {uploadQueue.length > 0 && (
          <div className="flex flex-col gap-1">
            {uploadQueue.map((item, i) => (
              <ProgressBar key={i} {...item} />
            ))}
          </div>
        )}

        {/* ─── Google Drive Button ────────────────────────────────────────────── */}
        {isGoogleDriveConfigured() && (
          <button
            onClick={(e) => { e.stopPropagation(); handleConnectGoogleDrive(); }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-accent/10 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/50 hover:bg-accent/20 hover:text-primary"
          >
            <Cloud className="h-4 w-4" />
            Connect Google Drive
          </button>
        )}

        {/* ─── Category Filter ────────────────────────────────────────────────── */}
        {files.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Filter:</span>
            {['All', ...FILE_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); }}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ─── File List ──────────────────────────────────────────────────────── */}
        {filteredFiles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {filteredFiles.map((f) => {
              const canPreview = isTextFile(f.type, f.name) || isHtmlFile(f.type, f.name);
              const isPreviewing = previewFileId === f.id;

              return (
                <div
                  key={f.id}
                  className="group/file flex flex-col gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  {/* ── File Header Row ──────────────────────────────────────── */}
                  <div className="flex items-center gap-2">
                    {f.storageType === 'google_drive' ? (
                      <Cloud className="h-4 w-4 flex-shrink-0 text-primary" />
                    ) : (
                      <FileIcon type={f.type} name={f.name} className="h-4 w-4 flex-shrink-0 text-primary" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground">{formatBytes(f.size)}</span>
                        <span className="text-[9px] px-1 rounded bg-muted text-muted-foreground">{f.category || 'Other'}</span>
                        {canPreview && (
                          <span className="text-[9px] px-1 rounded bg-primary/10 text-primary">
                            {isHtmlFile(f.type, f.name) ? 'HTML' : 'TXT'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Action Buttons ──────────────────────────────────────── */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity">
                      {/* Inline preview toggle for txt/html */}
                      {canPreview && (
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePreview(f.id); }}
                          className="rounded p-0.5 text-muted-foreground hover:text-primary"
                          title={isPreviewing ? 'Hide preview' : 'View inline'}
                        >
                          {isPreviewing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}

                      {/* Download / open */}
                      <a
                        href={f.url}
                        {...(f.storageType === 'google_drive'
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : { download: f.name })}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded p-0.5 text-muted-foreground hover:text-primary"
                        title={f.storageType === 'google_drive' ? 'Open in Google Drive' : 'Download'}
                      >
                        {f.storageType === 'google_drive'
                          ? <ExternalLink className="h-3.5 w-3.5" />
                          : <Download className="h-3.5 w-3.5" />
                        }
                      </a>

                      {/* Remove */}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* ── Tags ────────────────────────────────────────────────── */}
                  {f.tags && f.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 ml-6">
                      {f.tags.map((tag, i) => (
                        <span key={i} className="text-[8px] px-1 rounded bg-primary/10 text-primary">{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* ── Inline Viewer (TXT / HTML) ──────────────────────────── */}
                  {isPreviewing && (
                    <div className="mt-1">
                      {isHtmlFile(f.type, f.name) ? (
                        <HtmlViewer url={f.url} name={f.name} />
                      ) : (
                        <TxtViewer url={f.url} name={f.name} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Empty State ────────────────────────────────────────────────────── */}
        {files.length === 0 && !isUploading && (
          <p className="text-center text-[10px] text-muted-foreground/50 py-1">
            No files attached yet
          </p>
        )}
      </div>
    </BaseNode>
  );
});

FileAttachmentNode.displayName = 'FileAttachmentNode';
