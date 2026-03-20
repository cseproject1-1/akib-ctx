import { Bookmark, ExternalLink, Globe } from 'lucide-react';

export function BookmarkView({ data }: { data: any }) {
  if (!data.url) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Globe className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No URL set</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.ogImage && (
        <div className="relative w-full overflow-hidden rounded-xl border border-border">
          <img
            src={data.ogImage}
            alt={data.ogTitle || 'Bookmark'}
            className="w-full h-48 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {data.favicon && (
            <img src={data.favicon} alt="" className="h-5 w-5 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{data.hostname || ''}</span>
        </div>
        {data.ogTitle && (
          <h3 className="text-lg font-bold text-foreground">{data.ogTitle}</h3>
        )}
        {data.ogDescription && (
          <p className="text-sm text-muted-foreground leading-relaxed">{data.ogDescription}</p>
        )}
      </div>
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-primary hover:bg-accent transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
        <span className="truncate">{data.url}</span>
      </a>
    </div>
  );
}
