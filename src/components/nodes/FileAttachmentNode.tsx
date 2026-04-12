import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { toast } from 'sonner';
import { BaseNode } from './BaseNode';
import JSZip from 'jszip';
import {
  Paperclip, Upload, X, FileText, FileImage, FileArchive, FileCode,
  FileAudio, FileVideo, Download, Loader2, Cloud, ExternalLink,
  Eye, EyeOff, ZoomIn, ZoomOut, ChevronRight, Folder, FolderOpen,
  Table, Grid3X3, List, Check, Square, Search, ArrowUpDown,
  FileSpreadsheet, FileIcon as FileIconLucide,
} from 'lucide-react';
import { uploadCanvasFile } from '@/lib/r2/storage';
import { FileAttachmentNodeData, AttachedFile } from '@/types/canvas';
import { getGoogleDriveAuthUrl, isGoogleDriveConfigured } from '@/lib/googleDrive/service';

const FILE_CATEGORIES = ['Documents', 'Images', 'Videos', 'Audio', 'Archives', 'Code', 'Data', 'Other'] as const;

const ALLOWED_EXTENSIONS = [
  'txt', 'html', 'htm', 'pdf', 'csv', 'json', 'md', 'xml', 'log',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'mov',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp',
  'js', 'ts', 'css', 'scss', 'py', 'java', 'c', 'cpp', 'go', 'rs',
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileExtension(name: string | undefined): string {
  return name?.split('.').pop()?.toLowerCase() || '';
}

function getFileCategory(type: string, name: string | undefined): string {
  const ext = getFileExtension(name);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || type.startsWith('image/')) return 'Images';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext) || type.startsWith('video/')) return 'Videos';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext) || type.startsWith('audio/')) return 'Audio';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) || type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('compressed')) return 'Archives';
  if (['doc', 'docx', 'pdf', 'txt', 'rtf', 'odt'].includes(ext) || type.includes('document') || type === 'text/plain') return 'Documents';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'html', 'css', 'scss'].includes(ext) || type.includes('code') || type.includes('script')) return 'Code';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || type.includes('spreadsheet') || type === 'text/csv') return 'Data';
  return 'Other';
}

function FileIcon({ type, name, className }: { type: string; name: string | undefined; className?: string }) {
  const ext = getFileExtension(name);
  if (type.startsWith('image/')) return <FileImage className={className} />;
  if (type.startsWith('audio/')) return <FileAudio className={className} />;
  if (type.startsWith('video/')) return <FileVideo className={className} />;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) || type.includes('zip') || type.includes('rar') || type.includes('compressed')) return <FileArchive className={className} />;
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'html', 'css', 'scss', 'json', 'xml'].includes(ext)) return <FileCode className={className} />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className={className} />;
  if (type === 'text/plain' || ext === 'txt' || ext === 'md' || ext === 'log') return <FileText className={className} />;
  return <FileIconLucide className={className} />;
}

function isTextFile(type: string, name: string | undefined): boolean {
  const ext = getFileExtension(name);
  return type === 'text/plain' || type === 'text/markdown' || ['txt', 'md', 'log', 'csv'].includes(ext);
}

function isHtmlFile(type: string, name: string | undefined): boolean {
  const ext = getFileExtension(name);
  return type === 'text/html' || ['html', 'htm'].includes(ext);
}

function isImageFile(type: string, name: string | undefined): boolean {
  const ext = getFileExtension(name);
  return type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
}

function isArchiveFile(type: string, name: string | undefined): boolean {
  const ext = getFileExtension(name);
  return ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) || type.includes('zip') || type.includes('rar') || type.includes('compressed');
}

function isCSVFile(type: string, name: string | undefined): boolean {
  const ext = getFileExtension(name);
  return type === 'text/csv' || ext === 'csv';
}

function isOfficeFile(type: string, name: string | undefined): boolean {
  const ext = getFileExtension(name);
  return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
}

interface UploadingFile {
  name: string;
  progress: number;
  error?: string;
}

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
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(text => { if (!ac.signal.aborted) { setContent(text); setLoading(false); } })
      .catch(err => { if (!ac.signal.aborted) { setError(err.message); setLoading(false); } });

    return () => ac.abort();
  }, [url]);

  if (loading) return <div className="flex items-center justify-center p-4 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin mr-1" />Loading…</div>;
  if (error) return <div className="p-2 text-xs text-destructive">Failed: {error}</div>;

  const lines = (content || '').split('\n');
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 justify-end">
        <button onClick={e => { e.stopPropagation(); setFontSize(s => Math.max(8, s - 1)); }} className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
          <ZoomOut className="h-3 w-3" />
        </button>
        <span className="text-[9px] text-muted-foreground w-6 text-center">{fontSize}px</span>
        <button onClick={e => { e.stopPropagation(); setFontSize(s => Math.min(20, s + 1)); }} className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
          <ZoomIn className="h-3 w-3" />
        </button>
      </div>
      <div className="rounded-lg border border-border bg-[#0d1117] overflow-auto" style={{ maxHeight: 300, fontFamily: "'Fira Code', 'Consolas', monospace", fontSize }} onClick={e => e.stopPropagation()}>
        <table className="border-collapse w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-white/5">
                <td className="select-none pr-3 pl-2 text-right text-[10px] border-r border-white/10" style={{ color: '#6e7681', minWidth: 32 }}>{i + 1}</td>
                <td className="pl-3 pr-2 text-[#e6edf3] whitespace-pre">{line || '\u00a0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[9px] text-muted-foreground text-right">{lines.length} lines · {formatBytes((content || '').length)}</div>
    </div>
  );
});
TxtViewer.displayName = 'TxtViewer';

const ImageViewer = memo(({ url, name }: { url: string; name: string }) => {
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 justify-end">
        <button onClick={e => { e.stopPropagation(); setScale(s => Math.max(0.25, s - 0.25)); }} className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted" title="Zoom out">
          <ZoomOut className="h-3 w-3" />
        </button>
        <span className="text-[9px] text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={e => { e.stopPropagation(); setScale(s => Math.min(4, s + 0.25)); }} className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted" title="Zoom in">
          <ZoomIn className="h-3 w-3" />
        </button>
      </div>
      <div className="rounded-lg border border-border bg-[#0d1117] overflow-auto flex items-center justify-center p-2" style={{ maxHeight: 300 }} onClick={e => e.stopPropagation()}>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <img
          src={url}
          alt={name}
          className="max-w-full object-contain transition-transform"
          style={{ transform: `scale(${scale})`, display: loading || error ? 'none' : 'block' }}
          onLoad={() => setLoading(false)}
          onError={(e) => { setLoading(false); setError('Failed to load'); }}
        />
      </div>
    </div>
  );
});
ImageViewer.displayName = 'ImageViewer';

const CSVTableViewer = memo(({ url }: { url: string }) => {
  const [data, setData] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(10);

  useEffect(() => {
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.text(); })
      .then(text => {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const parsed = lines.map(line => {
          const cols: string[] = [];
          let cur = '';
          let quoted = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
            else if (ch === ',' && !quoted) { cols.push(cur); cur = ''; }
            else { cur += ch; }
          }
          cols.push(cur);
          return cols;
        });
        setData(parsed);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, [url]);

  if (loading) return <div className="flex items-center justify-center p-4 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin mr-1" />Loading…</div>;
  if (error) return <div className="p-2 text-xs text-destructive">{error}</div>;
  if (!data || data.length === 0) return <div className="p-2 text-xs text-muted-foreground">Empty file</div>;

  const headers = data[0];
  const rows = data.slice(1);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 justify-between">
        <span className="text-[9px] text-muted-foreground">{rows.length} rows × {headers.length} cols</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setFontSize(s => Math.max(8, s - 1))} className="p-0.5 rounded text-muted-foreground hover:bg-muted"><ZoomOut className="h-3 w-3" /></button>
          <button onClick={() => setFontSize(s => Math.min(14, s + 1))} className="p-0.5 rounded text-muted-foreground hover:bg-muted"><ZoomIn className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-auto" style={{ maxHeight: 300, fontSize }}>
        <table className="border-collapse w-full">
          <thead>
            <tr className="bg-muted">
              {headers.map((h, i) => (
                <th key={i} className="border border-border px-2 py-1 text-left text-[9px] font-semibold text-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((row, i) => (
              <tr key={i} className="hover:bg-muted/50">
                {row.map((cell, j) => (
                  <td key={j} className="border border-border px-2 py-1 text-foreground">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 100 && <div className="text-[8px] text-muted-foreground">Showing first 100 of {rows.length} rows</div>}
    </div>
  );
});
CSVTableViewer.displayName = 'CSVTableViewer';

const ZipViewer = memo(({ entries, url, name }: { entries: { name: string; size: number; isDirectory: boolean }[]; url: string; name: string }) => {
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handlePreview = async (entryName: string) => {
    if (entryName.endsWith('/')) return;
    setSelectedEntry(entryName);
    setLoading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const zip = await JSZip.loadAsync(blob);
      const file = zip.file(entryName);
      if (file) {
        const content = await file.async('string');
        setPreviewContent(content.slice(0, 5000));
      }
    } catch (err) {
      setPreviewContent('Failed to load');
    }
    setLoading(false);
  };

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground pb-1">
        <FolderOpen className="h-3 w-3" />
        <span>{entries.filter(e => e.isDirectory).length} folders</span>
        <span className="text-muted-foreground/50">·</span>
        <FileText className="h-3 w-3" />
        <span>{entries.filter(e => !e.isDirectory).length} files</span>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-auto flex flex-col" style={{ maxHeight: 250 }}>
        {sortedEntries.slice(0, 50).map((entry, i) => {
          const isFolder = entry.isDirectory;
          const isExpanded = expandedFolders.has(entry.name);
          const nameParts = entry.name.replace(/\/$/, '').split('/');
          const displayName = nameParts[nameParts.length - 1];
          const indent = nameParts.length - 1;

          return (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-0.5 hover:bg-muted/50 cursor-pointer"
              style={{ paddingLeft: `${8 + indent * 12}px` }}
              onClick={() => { if (isFolder) toggleFolder(entry.name); else handlePreview(entry.name); }}
            >
              {isFolder ? (
                <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              ) : (
                <FileText className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-[10px] text-foreground truncate flex-1">{displayName}</span>
              {!isFolder && <span className="text-[8px] text-muted-foreground">{formatBytes(entry.size)}</span>}
            </div>
          );
        })}
        {entries.length > 50 && <div className="text-[8px] text-muted-foreground p-2">...and {entries.length - 50} more</div>}
      </div>
      {(selectedEntry || loading) && (
        <div className="rounded-lg border border-border bg-[#0d1117] p-2 overflow-auto" style={{ maxHeight: 150 }}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <pre className="text-[9px] text-[#e6edf3] whitespace-pre-wrap">{previewContent}</pre>
          )}
        </div>
      )}
    </div>
  );
});
ZipViewer.displayName = 'ZipViewer';

interface FileCardProps {
  file: AttachedFile;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onPreview: (id: string) => void;
}

const FileCard = memo(({ file, selected, onSelect, onRemove, onPreview }: FileCardProps) => {
  const canPreview = isTextFile(file.type, file.name) || isHtmlFile(file.type, file.name) || isImageFile(file.type, file.name) || isCSVFile(file.name) || (isArchiveFile(file.type, file.name) && file.zipEntries);
  const canExpand = canPreview || isImageFile(file.type, file.name) || isArchiveFile(file.type, file.name);

  return (
    <div
      className={`group relative flex flex-col rounded-lg border transition-all cursor-pointer hover:border-primary/40 hover:shadow-sm ${
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
      }`}
      onClick={(e) => { if (!file.isDirectory) onPreview(file.id); }}
    >
      <div className="flex items-start gap-2 p-2">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(file.id); }}
          className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground"
        >
          {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 opacity-30" />}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <FileIcon type={file.type} name={file.name} className="h-4 w-4 flex-shrink-0 text-primary" />
            {file.isDirectory && <Folder className="h-3 w-3 text-amber-500" />}
          </div>
          <p className="text-[10px] font-medium text-foreground truncate leading-tight">{file.name}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[8px] text-muted-foreground">{formatBytes(file.size)}</span>
            {file.category && (
              <span className="text-[7px] px-1 rounded bg-muted text-muted-foreground">{file.category}</span>
            )}
            {file.zipEntryCount && (
              <span className="text-[7px] px-1 rounded bg-amber-500/10 text-amber-600">{file.zipEntryCount} items</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0.5 p-1 pt-0 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
        {canExpand && (
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(file.id); }}
            className="flex-1 rounded py-0.5 text-[8px] bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Eye className="h-2.5 w-2.5 inline mr-0.5" />
            View
          </button>
        )}
        <a
          href={file.url}
          download={file.name}
          onClick={(e) => e.stopPropagation()}
          className="rounded p-1 text-muted-foreground hover:text-primary"
          title="Download"
        >
          <Download className="h-3 w-3" />
        </a>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(file.id); }}
          className="rounded p-1 text-muted-foreground hover:text-destructive"
          title="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
});
FileCard.displayName = 'FileCard';

export const FileAttachmentNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as FileAttachmentNodeData;

  const files = useMemo(() => (nodeData.files || []) as AttachedFile[], [nodeData.files]);
  const [dragging, setDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const setFiles = useCallback((f: AttachedFile[]) => updateNodeData(id, { files: f }), [id, updateNodeData]);

  const processFiles = useCallback(async (fileList: FileList) => {
    const currentWorkspaceId = useCanvasStore.getState().workspaceId;
    if (!currentWorkspaceId) { toast.error('No active workspace'); return; }

    const fileArray = Array.from(fileList);
    const initialQueue: UploadingFile[] = fileArray.map(f => ({ name: f.name, progress: 0 }));
    setUploadQueue(initialQueue);

    const uploadPromises = fileArray.map((f, idx) => {
      const updateProgress = (pct: number) => {
        setUploadQueue(prev => prev.map((item, i) => i === idx ? { ...item, progress: pct } : item));
      };

      return uploadCanvasFile(currentWorkspaceId, f, updateProgress)
        .then(async ({ url, path }) => {
          updateProgress(100);
          const ext = getFileExtension(f.name);
          const type = f.type || (ALLOWED_EXTENSIONS.includes(ext) ? `text/${ext}` : 'application/octet-stream');
          
          let zipEntries: { name: string; size: number; isDirectory: boolean }[] | undefined;
          let zipEntryCount: number | undefined;
          const isDirectory = false;

          if (isArchiveFile(type, f.name)) {
            try {
              const response = await fetch(url);
              const blob = await response.blob();
              const zip = await JSZip.loadAsync(blob);
              zipEntries = Object.keys(zip.files).map(name => ({
                name,
                size: zip.files[name]._data?.uncompressedSize || 0,
                isDirectory: zip.files[name].dir,
              }));
              zipEntryCount = zipEntries.length;
            } catch {
              // Silently ignore extraction errors
            }
          }

          return {
            id: crypto.randomUUID(),
            name: f.name,
            size: f.size,
            type,
            url,
            path,
            storageType: 'r2' as const,
            category: getFileCategory(type, f.name),
            isDirectory,
            zipEntryCount,
            zipEntries,
          } as AttachedFile;
        })
        .catch(err => {
          setUploadQueue(prev => prev.map((item, i) => i === idx ? { ...item, error: err.message } : item));
          return null;
        });
    });

    const results = await Promise.all(uploadPromises);
    const succeeded = results.filter((r): r is AttachedFile => r !== null);

    if (succeeded.length > 0) {
      setFiles([...files, ...succeeded]);
      toast.success(`Uploaded ${succeeded.length} file${succeeded.length !== 1 ? 's' : ''}`);
    }
    if (results.length - succeeded.length > 0) {
      toast.error(`${results.length - succeeded.length} file(s) failed`);
    }
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
    if (expandedFileId === fileId) setExpandedFileId(null);
  }, [files, setFiles, expandedFileId]);

  const toggleFileExpansion = useCallback((fileId: string) => {
    setExpandedFileId(prev => prev === fileId ? null : fileId);
  }, []);

  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
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

  let filteredFiles = files.filter(f => {
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (sortBy === 'name') {
    filteredFiles = [...filteredFiles].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'size') {
    filteredFiles = [...filteredFiles].sort((a, b) => b.size - a.size);
  } else if (sortBy === 'date') {
    filteredFiles = [...filteredFiles].sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));
  }

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
      <div className="flex flex-col gap-2 min-w-[280px]">
        <div
          onDragEnter={handleDragEnter}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={(e) => { e.stopPropagation(); if (!isUploading) inputRef.current?.click(); }}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed cursor-pointer transition-all py-3 select-none ${
            dragging ? 'border-primary bg-primary/10 scale-[1.02]' :
            isUploading ? 'border-border bg-accent/10 cursor-not-allowed' :
            'border-border bg-accent/20 hover:border-primary/50 hover:bg-accent/40'
          }`}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Upload className={`h-5 w-5 ${dragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
          )}
          <span className="text-[10px] font-semibold text-muted-foreground">
            {isUploading ? `Uploading ${uploadQueue.length} file${uploadQueue.length !== 1 ? 's' : ''}…` : dragging ? 'Drop files here' : 'Drag files or click to browse'}
          </span>
          <span className="text-[9px] text-muted-foreground/60">
            Files, ZIP, RAR, Folders
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) { processFiles(e.target.files); e.target.value = ''; } }}
          />
        </div>

        {uploadQueue.length > 0 && (
          <div className="flex flex-col gap-1">
            {uploadQueue.map((item, i) => <ProgressBar key={i} {...item} />)}
          </div>
        )}

        {isGoogleDriveConfigured() && (
          <button
            onClick={(e) => { e.stopPropagation(); handleConnectGoogleDrive(); }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-accent/10 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/50 hover:bg-accent/20 hover:text-primary"
          >
            <Cloud className="h-4 w-4" />
            Connect Google Drive
          </button>
        )}

        {files.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-6 pl-7 pr-2 text-[10px] rounded bg-muted border-0 focus:ring-1 focus:ring-primary"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-6 text-[10px] rounded bg-muted px-2"
              >
                <option value="All">All</option>
                {FILE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <button
                onClick={() => setSortBy(s => s === 'name' ? 'size' : s === 'size' ? 'date' : 'name')}
                className="flex items-center gap-1 h-6 px-1.5 rounded bg-muted text-[10px] text-muted-foreground hover:text-foreground"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sortBy === 'name' ? 'Name' : sortBy === 'size' ? 'Size' : 'Date'}
              </button>
              <div className="flex items-center gap-0.5 border border-border rounded overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 ${viewMode === 'grid' ? 'bg-muted' : ''}`}
                >
                  <Grid3X3 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1 ${viewMode === 'list' ? 'bg-muted' : ''}`}
                >
                  <List className="h-3 w-3" />
                </button>
              </div>
            </div>

            {selectedFiles.size > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{selectedFiles.size} selected</span>
                <button onClick={() => { setFiles(files.filter(f => !selectedFiles.has(f.id))); setSelectedFiles(new Set()); }} className="text-destructive hover:underline">
                  Remove selected
                </button>
              </div>
            )}

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-3 gap-2">
                {filteredFiles.map(f => (
                  <FileCard
                    key={f.id}
                    file={f}
                    selected={selectedFiles.has(f.id)}
                    onSelect={toggleFileSelection}
                    onRemove={removeFile}
                    onPreview={toggleFileExpansion}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredFiles.map(f => (
                  <div
                    key={f.id}
                    className={`flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 ${selectedFiles.has(f.id) ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <button onClick={(e) => { e.stopPropagation(); toggleFileSelection(f.id); }}>
                      {selectedFiles.has(f.id) ? <Check className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 opacity-30" />}
                    </button>
                    <FileIcon type={f.type} name={f.name} className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                      <p className="text-[9px] text-muted-foreground">{formatBytes(f.size)} · {f.category}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {isTextFile(f.type, f.name) && <button onClick={(e) => { e.stopPropagation(); toggleFileExpansion(f.id); }} className="rounded p-1 hover:bg-muted"><Eye className="h-3 w-3" /></button>}
                      <a href={f.url} download={f.name} onClick={(e) => e.stopPropagation()} className="rounded p-1 hover:bg-muted"><Download className="h-3 w-3" /></a>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="rounded p-1 hover:bg-muted"><X className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expandedFileId && (
              <div className="mt-1">
                {(() => {
                  const f = files.find(f => f.id === expandedFileId);
                  if (!f) return null;
                  if (isArchiveFile(f.type, f.name) && f.zipEntries) {
                    return <ZipViewer entries={f.zipEntries} url={f.url} name={f.name} />;
                  }
                  if (isImageFile(f.type, f.name)) {
                    return <ImageViewer url={f.url} name={f.name} />;
                  }
                  if (isCSVFile(f.type, f.name)) {
                    return <CSVTableViewer url={f.url} />;
                  }
                  if (isHtmlFile(f.type, f.name)) {
                    return (
                      <div className="rounded-lg border border-border bg-card p-2">
                        <iframe srcDoc="" title={f.name} className="w-full h-[200px] rounded border-0" />
                      </div>
                    );
                  }
                  return <TxtViewer url={f.url} name={f.name} />;
                })()}
              </div>
            )}
          </div>
        )}

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