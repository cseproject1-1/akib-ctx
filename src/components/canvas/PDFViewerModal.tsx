import { useState, useCallback, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize, Download, ExternalLink } from 'lucide-react';

interface PDFViewerModalProps {
  url: string;
  fileName: string;
  fileSize?: number;
  fileType?: 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx';
  onClose: () => void;
}

function isOfficeFile(fileType?: string) {
  return fileType === 'doc' || fileType === 'docx' || fileType === 'ppt' || fileType === 'pptx';
}

function getOfficeViewerUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

export function PDFViewerModal({ url, fileName, fileSize, fileType, onClose }: PDFViewerModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isOffice = isOfficeFile(fileType);

  const fileSizeStr = fileSize ? `${(fileSize / 1024).toFixed(1)} kB` : '';

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 300));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 50));

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!isOffice) {
        if (e.key === 'ArrowRight') setCurrentPage((p) => p + 1);
        if (e.key === 'ArrowLeft') setCurrentPage((p) => Math.max(1, p - 1));
      }
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isOffice]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  const viewerUrl = isOffice ? getOfficeViewerUrl(url) : `${url}#page=${currentPage}`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground truncate max-w-[300px]">{fileName}</span>
          {fileSizeStr && (
            <span className="text-xs text-muted-foreground">{fileSizeStr}</span>
          )}
          {isOffice && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {fileType?.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ToolBtn onClick={handleOpenExternal} title="Open in new tab">
            <ExternalLink className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={handleDownload} title="Download">
            <Download className="h-4 w-4" />
          </ToolBtn>
          <div className="h-6 w-px bg-border mx-1" />
          <ToolBtn onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </ToolBtn>
        </div>
      </div>

      {/* Viewer body */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <div className="absolute right-4 top-4 z-10 flex flex-col gap-1.5">
          <ToolBtn onClick={toggleFullscreen} title="Fullscreen">
            <Maximize className="h-4 w-4" />
          </ToolBtn>
        </div>

        <div className="flex h-full w-full items-center justify-center overflow-auto bg-background/50 p-4">
          {isOffice ? (
            <iframe
              src={viewerUrl}
              className="rounded-lg shadow-2xl border border-border"
              style={{ width: '100%', height: 'calc(100vh - 80px)', maxWidth: '1200px', maxHeight: '1200px' }}
              title={fileName}
              allowFullScreen
            />
          ) : (
            <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
              <iframe
                src={viewerUrl}
                className="rounded-lg shadow-2xl border border-border"
                style={{ width: '800px', height: 'calc(100vh - 120px)', maxHeight: '1200px', background: 'white' }}
                title={fileName}
              />
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          {!isOffice && (
            <>
              {/* Zoom controls */}
              <div className="flex items-center gap-0.5 rounded-lg border-2 border-border bg-card px-1 py-0.5 shadow-[3px_3px_0px_hsl(0,0%,10%)]">
                <ToolBtn onClick={handleZoomOut} title="Zoom out">
                  <ZoomOut className="h-3.5 w-3.5" />
                </ToolBtn>
                <span className="px-2 text-xs font-bold text-muted-foreground min-w-[3rem] text-center">
                  {zoom}%
                </span>
                <ToolBtn onClick={handleZoomIn} title="Zoom in">
                  <ZoomIn className="h-3.5 w-3.5" />
                </ToolBtn>
              </div>

              {/* Page counter */}
              <div className="rounded-lg border-2 border-border bg-card px-3 py-1.5 shadow-[3px_3px_0px_hsl(0,0%,10%)]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    value={currentPage}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v > 0) setCurrentPage(v);
                    }}
                    className="w-8 bg-transparent text-center text-xs font-bold text-foreground outline-none"
                    min={1}
                  />
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="rounded-lg border-2 border-border bg-card p-1.5 text-muted-foreground shadow-[3px_3px_0px_hsl(0,0%,10%)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
