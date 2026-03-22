import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize, Download, ExternalLink, Search, Trash2, StickyNote, Image, Search as SearchIcon, Loader2, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Grid3X3, Sidebar, LayoutGrid, LayoutList, List, BookOpen, RotateCw, RotateCcw, CloudOff, Wifi, FileText } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocumentProxy } from 'pdfjs-dist';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getFileBlob, cacheFileBlob } from '@/lib/cache/indexedDB';

// Configure PDF.js worker using Vite-compatible URL pattern
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFViewerModalProps {
  url: string;
  fileName: string;
  fileSize?: number;
  fileType?: 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'csv' | 'txt';
  onClose: () => void;
}

interface ThumbnailProps {
  file: any;
  pageNumber: number;
  width: number;
  onClick: () => void;
  isSelected: boolean;
}

// Thumbnail component that only renders when visible
const Thumbnail = ({ file, pageNumber, width, onClick, isSelected }: ThumbnailProps) => {
  const [shouldRender, setShouldRender] = useState(false);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (thumbnailRef.current) observer.observe(thumbnailRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={thumbnailRef}
      onClick={onClick}
      className={`
        relative cursor-pointer rounded overflow-hidden border-2 transition-all min-h-[140px]
        ${isSelected ? 'border-primary shadow-lg scale-105' : 'border-transparent hover:border-primary/50'}
      `}
      title={`Page ${pageNumber}`}
    >
      {shouldRender && file ? (
        <Document file={file} renderMode="canvas" loading={<div className="h-full bg-muted animate-pulse" />}>
          <Page
            pageNumber={pageNumber}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      ) : (
        <div className="h-full bg-muted animate-pulse" />
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-1 text-center font-medium">
        {pageNumber}
      </div>
    </div>
  );
};

function isOfficeFile(fileType?: string) {
  return fileType === 'doc' || fileType === 'docx' || fileType === 'ppt' || fileType === 'pptx' || fileType === 'xls' || fileType === 'xlsx';
}

function isTextFile(fileType?: string) {
  return fileType === 'csv' || fileType === 'txt';
}

function getOfficeViewerUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

export function PDFViewerModal({ url, fileName, fileSize, fileType, onClose }: PDFViewerModalProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'double' | 'continuous'>('single');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [localFileData, setLocalFileData] = useState<Blob | null>(null);
  const isOffice = isOfficeFile(fileType);

  const fileSizeStr = fileSize ? `${(fileSize / 1024).toFixed(1)} kB` : '';

  // Load and cache PDF data
  useEffect(() => {
    if (isOffice) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const loadFile = async () => {
      try {
        setIsLoading(true);

        // 1. Try IndexedDB cache
        const cached = await getFileBlob(url);
        if (cached && cached.blob && isMounted) {
          console.log('[PDF Viewer] Loaded from cache');
          setLocalFileData(cached.blob);
          setIsLoading(false);
          return;
        }

        // 2. Fetch from network
        console.log('[PDF Viewer] Fetching from network');
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const blob = await response.blob();
        if (isMounted) {
          setLocalFileData(blob);
          setIsLoading(false);
          
          // 3. Cache for next time
          cacheFileBlob(url, blob, 'application/pdf', fileName, fileSize || 0)
            .catch(err => console.warn('[PDF Viewer] Caching failed:', err));
        }
      } catch (error) {
        console.error('[PDF Viewer] Load failed:', error);
        if (isMounted) {
          setIsLoading(false);
          toast.error(error instanceof Error ? error.message : 'Failed to load document');
        }
      }
    };

    loadFile();
    return () => { isMounted = false; };
  }, [url, isOffice, fileName, fileSize]);

  // Memoize office viewer URL
  const viewerUrl = useMemo(() => {
    if (isOffice) {
      return getOfficeViewerUrl(url);
    }
    return null;
  }, [url, isOffice]);

  // Handle PDF loaded
  const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
  }, []);

  // Handle PDF load error
  const onDocumentLoadError = useCallback((error: Error) => {
    setIsLoading(false);
    console.error('[PDF Viewer] Failed to load PDF:', error.message);
    toast.error(`Failed to load PDF: ${error.message}`);
  }, []);

  // Handle zoom controls with throttling
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 25, 400)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 25, 25)), []);
  const handleZoomReset = useCallback(() => setZoom(100), []);

  // Fit to width logic
  const handleFitToWidth = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 48; // Padding
    // Default PDF width is usually around 595-612pt (A4/Letter)
    // We'll estimate or just set a scale that looks good
    setZoom(Math.floor((containerWidth / 800) * 100));
  }, []);

  // Handle Ctrl + Mouse Wheel Zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) handleZoomIn();
        else handleZoomOut();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) container.removeEventListener('wheel', handleWheel);
    };
  }, [handleZoomIn, handleZoomOut]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!isOffice) {
        if (e.key === 'ArrowRight') setCurrentPage((p) => Math.min(p + 1, numPages));
        if (e.key === 'ArrowLeft') setCurrentPage((p) => Math.max(1, p - 1));
      }
      
      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        handleZoomIn();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isOffice, numPages, handleZoomIn, handleZoomOut, handleZoomReset]);

  // Handle download
  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  }, [url, fileName]);

  // Handle open external
  const handleOpenExternal = useCallback(() => {
    window.open(url, '_blank');
  }, [url]);

  // Handle fullscreen
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

  // Thumbnail navigation
  const handleThumbnailClick = (page: number) => {
    setCurrentPage(page);
    // Scroll to page
    const pageElement = pageRefs.current[page - 1];
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Search functionality (throttled)
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Simple search - in a real implementation, use pdf.js text content extraction
    // This is a placeholder that highlights current page
    setSearchResults([currentPage]);
    setCurrentSearchIndex(0);
  }, [currentPage]);

  const goToNextSearchResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    setCurrentPage(searchResults[nextIndex]);
  };

  const goToPrevSearchResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    setCurrentPage(searchResults[prevIndex]);
  };

  // Generate thumbnail pages (limit to first 20 for performance)
  const thumbnailPages = useMemo(() => {
    const pages = [];
    const maxThumbnails = Math.min(numPages, 20);
    for (let i = 1; i <= maxThumbnails; i++) {
      pages.push(i);
    }
    return pages;
  }, [numPages]);

  if (isTextFile(fileType)) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-foreground truncate max-w-[300px]">{fileName}</span>
            {fileSizeStr && (
              <span className="text-xs text-muted-foreground">{fileSizeStr}</span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {fileType?.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ToolBtn onClick={() => window.open(url, '_blank')} title="Open in new tab">
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
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <FileText className="h-16 w-16" />
            <p className="text-sm">{fileName}</p>
            <p className="text-xs">This file type cannot be previewed inline.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isOffice) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-foreground truncate max-w-[300px]">{fileName}</span>
            {fileSizeStr && (
              <span className="text-xs text-muted-foreground">{fileSizeStr}</span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {fileType?.toUpperCase()}
            </span>
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
        <div className="flex-1 relative overflow-hidden">
          <div className="flex h-full w-full items-center justify-center overflow-auto bg-background/50 p-4">
            <div className="flex flex-col items-center justify-center" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}>
              <iframe
                src={viewerUrl || ''}
                className="rounded-lg shadow-2xl border border-border"
                style={{ width: '100%', height: 'calc(100dvh - 120px)', maxWidth: '1200px', maxHeight: '1200px' }}
                title={fileName}
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground truncate max-w-[300px]">{fileName}</span>
          {fileSizeStr && (
            <span className="text-xs text-muted-foreground">{fileSizeStr}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Search */}
          <div className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search..."
              className="w-24 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <>
                <span className="text-xs text-muted-foreground">{currentSearchIndex + 1}/{searchResults.length}</span>
                <button onClick={goToPrevSearchResult} className="p-0.5 hover:text-primary">
                  <ArrowLeft className="h-3 w-3" />
                </button>
                <button onClick={goToNextSearchResult} className="p-0.5 hover:text-primary">
                  <ArrowRight className="h-3 w-3" />
                </button>
              </>
            )}
          </div>

          {/* View mode */}
          <div className="flex items-center gap-0.5 bg-muted rounded-md px-1 py-0.5">
            <button
              onClick={() => setViewMode('single')}
              className={`p-1 rounded ${viewMode === 'single' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Single page"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('double')}
              className={`p-1 rounded ${viewMode === 'double' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Two pages"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('continuous')}
              className={`p-1 rounded ${viewMode === 'continuous' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Continuous scroll"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-0.5 bg-muted rounded-md px-1 py-0.5">
            <ToolBtn onClick={() => setRotation((r) => (r - 90) % 360)} title="Rotate left">
              <RotateCcw className="h-3.5 w-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate right">
              <RotateCw className="h-3.5 w-3.5" />
            </ToolBtn>
          </div>

          <ToolBtn onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle thumbnails">
            <Sidebar className={`h-4 w-4 ${isSidebarOpen ? 'text-primary' : ''}`} />
          </ToolBtn>

          <ToolBtn onClick={handleOpenExternal} title="Open in new tab">
            <ExternalLink className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={handleDownload} title="Download">
            <Download className="h-4 w-4" />
          </ToolBtn>
          <div className="h-6 w-px bg-border mx-1" />
          <ToolBtn onClick={toggleFullscreen} title="Fullscreen">
            <Maximize className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </ToolBtn>
        </div>
      </div>

      {/* Viewer body */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Thumbnail sidebar */}
        {isSidebarOpen && (
          <div className="w-32 bg-muted/50 p-2 overflow-y-auto border-r border-border">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Thumbnails</div>
            <div className="flex flex-col gap-2">
              {thumbnailPages.map((page) => (
                <Thumbnail
                  key={page}
                  file={localFileData}
                  pageNumber={page}
                  width={100}
                  onClick={() => handleThumbnailClick(page)}
                  isSelected={page === currentPage}
                />
              ))}
              {numPages > 20 && (
                <div className="text-[10px] text-muted-foreground text-center">
                  +{numPages - 20} more pages
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main viewer */}
        <div className="flex-1 overflow-auto bg-background/50 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : localFileData ? (
            <Document
              file={localFileData}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
              className="flex flex-col items-center gap-4"
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
                <div
                  key={page}
                  ref={(el) => { pageRefs.current[page - 1] = el; }}
                  className={`relative ${page === currentPage ? 'ring-2 ring-primary' : ''}`}
                >
                  <Page
                    pageNumber={page}
                    scale={zoom / 100}
                    rotate={rotation}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={<div className="bg-muted animate-pulse" style={{ width: 800 * (zoom / 100), height: 1000 * (zoom / 100) }} />}
                  />
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {page} / {numPages}
                  </div>
                </div>
              ))}
            </Document>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <CloudOff className="h-8 w-8" />
              <p className="text-sm">Failed to load local data</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 z-10">
        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 rounded-lg border-2 border-border bg-card px-1 py-0.5 shadow-[3px_3px_0px_hsl(0,0%,10%)]">
          <ToolBtn onClick={handleZoomOut} title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </ToolBtn>
          
          <select 
            value={zoom} 
            onChange={(e) => setZoom(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-muted-foreground outline-none px-1 cursor-pointer hover:text-foreground"
          >
            <option value="25">25%</option>
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100">100%</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
            <option value="200">200%</option>
            <option value="300">300%</option>
            <option value="400">400%</option>
          </select>

          <ToolBtn onClick={handleZoomIn} title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </ToolBtn>
          
          <div className="h-4 w-px bg-border mx-1" />
          
          <ToolBtn onClick={handleFitToWidth} title="Fit to width">
            <Maximize className="h-3.5 w-3.5" />
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
                if (v > 0 && v <= numPages) setCurrentPage(v);
              }}
              className="w-12 bg-transparent text-center text-xs font-bold text-foreground outline-none"
              min={1}
              max={numPages}
            />
            <span className="text-muted-foreground text-xs">/ {numPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Offline indicator */}
        {isOffline && (
          <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded text-xs">
            <Wifi className="h-3 w-3" />
            Offline mode
          </div>
        )}
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
