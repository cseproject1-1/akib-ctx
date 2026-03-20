import { Paperclip, Download, FileText, FileImage, FileArchive, FileCode, FileAudio, FileVideo, Cloud, ExternalLink } from 'lucide-react';

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  storageType?: string;
  category?: string;
  tags?: string[];
}

function FileIcon({ type, className }: { type: string; className?: string }) {
  if (type.startsWith('image/')) return <FileImage className={className} />;
  if (type.startsWith('audio/')) return <FileAudio className={className} />;
  if (type.startsWith('video/')) return <FileVideo className={className} />;
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

export function FileAttachmentView({ data }: { data: any }) {
  const files: AttachedFile[] = data.files || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-wider">
        <Paperclip className="h-4 w-4" />
        <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground/50 italic text-center py-8">No files attached</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              {f.storageType === 'google_drive' ? (
                <Cloud className="h-6 w-6 flex-shrink-0 text-primary" />
              ) : (
                <FileIcon type={f.type} className="h-6 w-6 flex-shrink-0 text-primary" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{f.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</span>
                  {f.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f.category}</span>
                  )}
                </div>
                {f.tags && f.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.tags.map((tag, i) => (
                      <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <a
                href={f.url}
                {...(f.storageType === 'google_drive' ? { target: '_blank', rel: 'noopener noreferrer' } : { download: f.name })}
                className="rounded-lg p-2 bg-accent text-muted-foreground hover:text-primary transition-colors"
              >
                {f.storageType === 'google_drive' ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
