import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageLightboxModalProps {
  url: string;
  alt?: string;
  onClose: () => void;
}

export function ImageLightboxModal({ url, alt, onClose }: ImageLightboxModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showZoomPill, setShowZoomPill] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarTimer = useRef<ReturnType<typeof setTimeout>>();
  const zoomPillTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── close ──
  const handleClose = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().finally(onClose);
    } else {
      onClose();
    }
  }, [onClose]);

  // ── zoom ──
  const adjustZoom = useCallback((delta: number) => {
    setZoom((prev) => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(Math.max(next, 0.5), 5);
    });
    setShowZoomPill(true);
    clearTimeout(zoomPillTimer.current);
    zoomPillTimer.current = setTimeout(() => setShowZoomPill(false), 1500);
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ── auto-hide toolbar ──
  const resetToolbarTimer = useCallback(() => {
    setShowToolbar(true);
    clearTimeout(toolbarTimer.current);
    toolbarTimer.current = setTimeout(() => setShowToolbar(false), 2000);
  }, []);

  // ── fullscreen on mount ──
  useEffect(() => {
    const el = containerRef.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    const onFsChange = () => {
      if (!document.fullscreenElement) handleClose();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [handleClose]);

  // ── keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === '+' || e.key === '=') adjustZoom(0.25);
      if (e.key === '-') adjustZoom(-0.25);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose, adjustZoom]);

  // ── start toolbar timer on mount ──
  useEffect(() => {
    resetToolbarTimer();
    return () => clearTimeout(toolbarTimer.current);
  }, [resetToolbarTimer]);

  // ── scroll wheel zoom ──
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      adjustZoom(delta);
    },
    [adjustZoom]
  );

  // ── pan ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoom <= 1) return;
      e.preventDefault();
      e.stopPropagation();
      setPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [zoom, pan]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!panning) return;
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    },
    [panning]
  );

  const handlePointerUp = useCallback(() => {
    setPanning(false);
  }, []);

  // ── download ──
  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const a = document.createElement('a');
      a.href = url;
      a.download = alt || 'image';
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
    },
    [url, alt]
  );

  const toolbarClass = `absolute right-4 top-4 flex items-center gap-2 transition-opacity duration-300 ${
    showToolbar ? 'opacity-100' : 'opacity-0 pointer-events-none'
  }`;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      onWheel={handleWheel}
      onPointerMove={(e) => {
        resetToolbarTimer();
        handlePointerMove(e);
      }}
      onDoubleClick={resetZoom}
    >
      {/* Toolbar */}
      <div className={toolbarClass} onPointerDown={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            adjustZoom(-0.25);
          }}
          title="Zoom out"
          className="rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            adjustZoom(0.25);
          }}
          title="Zoom in"
          className="rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          onClick={handleDownload}
          title="Download"
          className="rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <Download className="h-5 w-5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          title="Close"
          className="rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Zoom indicator pill */}
      <div
        className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur-sm transition-opacity duration-300 ${
          showZoomPill ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {Math.round(zoom * 100)}%
      </div>

      {/* Image */}
      <img
        src={url}
        alt={alt || 'Image'}
        className="select-none object-contain"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          maxWidth: '95vw',
          maxHeight: '95vh',
          cursor: zoom > 1 ? (panning ? 'grabbing' : 'grab') : 'default',
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          resetZoom();
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        draggable={false}
      />
    </div>
  );
}
