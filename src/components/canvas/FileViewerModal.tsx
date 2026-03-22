import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { toast } from 'sonner';
import { X, Download, ExternalLink, Loader2, ZoomIn, ZoomOut, FileText, Sheet, Presentation, File, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocumentProxy } from 'pdfjs-dist';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getFileBlob, cacheFileBlob } from '@/lib/cache/indexedDB';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ── Types ──

interface FileViewerModalProps {
  url: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  onClose: () => void;
}

// ── Helpers ──

function isOffice(t?: string) {
  return t === 'doc' || t === 'docx' || t === 'ppt' || t === 'pptx' || t === 'xls' || t === 'xlsx';
}
function isCSV(t?: string) { return t === 'csv'; }
function isTXT(t?: string) { return t === 'txt'; }
function isPDF(t?: string) { return t === 'pdf' || !t; }

function fileIcon(t?: string) {
  if (isPDF(t)) return <FileText className="h-4 w-4" />;
  if (t === 'ppt' || t === 'pptx') return <Presentation className="h-4 w-4" />;
  if (isCSV(t) || t === 'xls' || t === 'xlsx') return <Sheet className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function officeUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        cols.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    result.push(cols);
  }
  return result;
}

// ── Lazy Page (IntersectionObserver) ──

const LazyPage = memo(function LazyPage({
  pageNumber, zoom, rotation,
}: { pageNumber: number; zoom: number; rotation: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex flex-col items-center">
      {visible ? (
        <Page
          pageNumber={pageNumber}
          scale={zoom}
          rotate={rotation}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={<div className="bg-white/5 animate-pulse rounded" style={{ width: 595 * zoom, height: 842 * zoom }} />}
          error={<div className="flex items-center justify-center bg-white/5 text-white/30 text-xs rounded" style={{ width: 595 * zoom, height: 842 * zoom }}>Page {pageNumber} failed</div>}
        />
      ) : (
        <div className="bg-white/5 animate-pulse rounded" style={{ width: 595 * zoom, height: 842 * zoom }} />
      )}
      <span className="mt-1 mb-3 text-[10px] text-white/25 select-none">{pageNumber}</span>
    </div>
  );
});

// ── PDF Content ──

function PDFContent({ url, fileName, fileSize }: { url: string; fileName: string; fileSize?: number }) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fileData, setFileData] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load PDF blob
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const cached = await getFileBlob(url);
        if (cached?.blob && active) {
          setFileData(cached.blob);
          setLoading(false);
          return;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (active) {
          setFileData(blob);
          setLoading(false);
          cacheFileBlob(url, blob, 'application/pdf', fileName, fileSize || 0).catch(() => { });
        }
      } catch (err) {
        if (active) { setLoading(false); setError('Failed to load PDF'); }
      }
    };
    load();
    return () => { active = false; };
  }, [url, fileName, fileSize]);

  // Track current page from scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const pages = el.querySelectorAll('[data-page]');
      const top = el.scrollTop + el.clientHeight / 3;
      for (const p of pages) {
        if ((p as HTMLElement).offsetTop <= top) {
          const n = Number((p as HTMLElement).dataset.page);
          if (n) setCurrentPage(n);
        }
      }
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [numPages]);

  // Ctrl+scroll zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => Math.min(Math.max(z + (e.deltaY > 0 ? -0.1 : 0.1), 0.25), 4));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(z + 0.25, 4)); }
      if (e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(z - 0.25, 0.25)); }
      if (e.key === '0') { e.preventDefault(); setZoom(1); setRotation(0); }
      if (e.key === 'ArrowLeft') setCurrentPage((p) => Math.max(1, p - 1));
      if (e.key === 'ArrowRight') setCurrentPage((p) => Math.min(numPages, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [numPages]);

  const scrollToPage = useCallback((page: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector(`[data-page="${page}"]`);
    if (target) (target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/40" /></div>;
  }
  if (error || !fileData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-white/50">
        <FileText className="h-12 w-12" />
        <p className="text-sm">{error || 'Failed to load'}</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-auto bg-[#111]">
      <Document
        file={fileData}
        onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
        onLoadError={() => setError('Invalid or corrupted PDF')}
        loading={<div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/40" /></div>}
        className="flex flex-col items-center py-6 gap-0"
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
          <div key={page} data-page={page}>
            <LazyPage pageNumber={page} zoom={zoom} rotation={rotation} />
          </div>
        ))}
      </Document>

      {/* Bottom bar: zoom + page nav + rotate */}
      <div className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur-md shadow-lg">
        <button onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))} title="Zoom out" className="p-1 text-white/60 hover:text-white transition-colors">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-[3rem] text-center text-xs text-white/60 tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} title="Zoom in" className="p-1 text-white/60 hover:text-white transition-colors">
          <ZoomIn className="h-4 w-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-white/15" />

        <button onClick={() => scrollToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="p-1 text-white/60 hover:text-white disabled:opacity-20 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[3.5rem] text-center text-xs text-white/60 tabular-nums">{currentPage} / {numPages}</span>
        <button onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages} className="p-1 text-white/60 hover:text-white disabled:opacity-20 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-white/15" />

        <button onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate" className="p-1 text-white/60 hover:text-white transition-colors">
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Office Content ──

function OfficeContent({ url, fileName }: { url: string; fileName: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative h-full">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
            <span className="text-xs text-white/30">Loading {fileName}…</span>
          </div>
        </div>
      )}
      <iframe
        src={officeUrl(url)}
        title={fileName}
        className="h-full w-full border-0"
        allowFullScreen
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// ── CSV Content ──

function CSVContent({ url }: { url: string }) {
  const [data, setData] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(); return r.text(); })
      .then((text) => { if (active) { setData(parseCSV(text)); setLoading(false); } })
      .catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [url]);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/40" /></div>;
  if (error || !data || data.length === 0) {
    return <div className="flex h-full items-center justify-center text-white/50">{error ? 'Failed to load file' : 'Empty file'}</div>;
  }

  const headers = data[0];
  const rows = data.slice(1);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-1.5">
        <span className="text-[10px] text-white/30">{rows.length} rows × {headers.length} cols</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="sticky top-0 border-b border-white/10 bg-[#1a1a1a] px-3 py-2 text-left text-xs font-semibold text-white/70 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                {headers.map((_, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-white/60 whitespace-nowrap max-w-[300px] truncate">
                    {row[ci] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── TXT Content ──

function TXTContent({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(); return r.text(); })
      .then((t) => { if (active) { setText(t); setLoading(false); } })
      .catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [url]);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/40" /></div>;
  if (error) return <div className="flex h-full items-center justify-center text-white/50">Failed to load file</div>;

  const lines = (text || '').split('\n');

  return (
    <div className="h-full overflow-auto bg-[#0d0d0d]">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="hover:bg-white/[0.03]">
              <td className="sticky left-0 w-12 select-none border-r border-white/5 bg-[#0d0d0d] px-2 py-0 text-right text-[11px] text-white/20 font-mono">
                {i + 1}
              </td>
              <td className="px-4 py-0 font-mono text-sm text-white/70 leading-6 whitespace-pre">
                {line || ' '}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Fallback ──

function FallbackContent({ fileName, fileType }: { fileName: string; fileType?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-white/40">
      {fileIcon(fileType)}
      <p className="text-sm font-medium text-white/60">{fileName}</p>
      <p className="text-xs">Preview not available for this file type</p>
    </div>
  );
}

// ── Main Modal ──

export function FileViewerModal({ url, fileName, fileSize, fileType, onClose }: FileViewerModalProps) {
  const [showBar, setShowBar] = useState(true);
  const [fsActive, setFsActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleClose = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { }).finally(onClose);
    } else {
      onClose();
    }
  }, [onClose]);

  // Fullscreen
  useEffect(() => {
    const el = containerRef.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen()
        .then(() => setFsActive(true))
        .catch(() => setFsActive(false));
    } else {
      setFsActive(true);
    }
    const onFs = () => {
      if (!document.fullscreenElement) handleClose();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [handleClose]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  // Auto-hide toolbar
  const resetTimer = useCallback(() => {
    setShowBar(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowBar(false), 3000);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => clearTimeout(hideTimer.current);
  }, [resetTimer]);

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  }, [url, fileName]);

  const handleExternal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank');
  }, [url]);

  const ext = fileType?.toLowerCase();
  const badge = ext ? ext.toUpperCase() : 'FILE';

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-black text-white ${fsActive ? 'fixed inset-0 z-[100]' : 'fixed inset-0 z-[100]'}`}
      onMouseMove={resetTimer}
    >
      {/* Top bar */}
      <div
        className={`relative z-20 flex items-center justify-between bg-black/90 px-4 py-2 backdrop-blur-md transition-opacity duration-300 ${showBar ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white/40">{fileIcon(ext)}</span>
          <span className="text-sm font-medium truncate max-w-[40vw]">{fileName}</span>
          {fileSize ? <span className="text-xs text-white/30">{fmtSize(fileSize)}</span> : null}
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">{badge}</span>
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={handleDownload} title="Download (D)" className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={handleExternal} title="Open in new tab (O)" className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white">
            <ExternalLink className="h-4 w-4" />
          </button>
          <button onClick={handleClose} title="Close (Esc)" className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isPDF(ext) && <PDFContent url={url} fileName={fileName} fileSize={fileSize} />}
        {isOffice(ext) && <OfficeContent url={url} fileName={fileName} />}
        {isCSV(ext) && <CSVContent url={url} />}
        {isTXT(ext) && <TXTContent url={url} />}
        {!isPDF(ext) && !isOffice(ext) && !isCSV(ext) && !isTXT(ext) && (
          <FallbackContent fileName={fileName} fileType={ext} />
        )}
      </div>
    </div>
  );
}
