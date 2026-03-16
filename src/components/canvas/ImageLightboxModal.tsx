import { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop as CropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Download, 
  Maximize2, ChevronLeft, ChevronRight, 
  Images, Grid3X3, Trash2, Edit3, Palette, Contrast,
  FlipHorizontal, FlipVertical, Sun, Crop as CropIcon, Wifi
} from 'lucide-react';
import { toast } from 'sonner';
import { getFileBlob, cacheFileBlob } from '@/lib/cache/indexedDB';

interface ImageLightboxModalProps {
  url: string;
  alt?: string;
  onClose: () => void;
  galleryImages?: string[]; // URLs for gallery navigation
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

const DEFAULT_FILTERS: ImageFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
};

export function ImageLightboxModal({ 
  url, 
  alt, 
  onClose, 
  galleryImages = [], 
  currentIndex = 0,
  onNavigate 
}: ImageLightboxModalProps) {
  const [zoom, setZoom] = useState(1);
  const [filters, setFilters] = useState<ImageFilters>(DEFAULT_FILTERS);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<CropType>({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const [showFilters, setShowFilters] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasGallery = galleryImages.length > 1;

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (hasGallery && onNavigate) {
        if (e.key === 'ArrowRight') onNavigate(Math.min(currentIndex + 1, galleryImages.length - 1));
        if (e.key === 'ArrowLeft') onNavigate(Math.max(currentIndex - 1, 0));
      }
      if (e.key === '+') setZoom((z) => Math.min(z + 0.25, 4));
      if (e.key === '-') setZoom((z) => Math.max(z - 0.25, 0.25));
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, hasGallery, onNavigate, currentIndex, galleryImages.length]);

  // Handle offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cache image for offline use
  const cacheImageForOffline = useCallback(async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await cacheFileBlob(url, blob, 'image', alt || 'image', 0);
      console.log('[Image Viewer] Image cached for offline use');
    } catch (error) {
      console.error('[Image Viewer] Failed to cache image:', error);
    }
  }, [url, alt]);

  // Check if image is cached and get blob URL
  const getCachedBlobUrl = useCallback(async () => {
    try {
      const cached = await getFileBlob(url);
      if (cached && cached.blob) {
        return URL.createObjectURL(cached.blob);
      }
    } catch (error) {
      console.error('[Image Viewer] Failed to get cached blob:', error);
    }
    return null;
  }, [url]);

  // Load cached image URL on mount
  useEffect(() => {
    const loadCachedImage = async () => {
      if (isOffline) {
        const cachedUrl = await getCachedBlobUrl();
        if (cachedUrl) {
          setCachedImageUrl(cachedUrl);
        }
      }
    };
    loadCachedImage();
  }, [isOffline, getCachedBlobUrl]);

  // Cache image after it loads
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    cacheImageForOffline();
  }, [cacheImageForOffline]);

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

  // Handle zoom
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));

  // Handle rotation
  const handleRotate = (degrees: number) => {
    setFilters((f) => ({ ...f, rotation: (f.rotation + degrees) % 360 }));
  };

  // Handle flip
  const handleFlip = (axis: 'horizontal' | 'vertical') => {
    setFilters((f) => ({
      ...f,
      flipHorizontal: axis === 'horizontal' ? !f.flipHorizontal : f.flipHorizontal,
      flipVertical: axis === 'vertical' ? !f.flipVertical : f.flipVertical,
    }));
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof ImageFilters, value: number | boolean) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setZoom(1);
    toast.success('Filters reset');
  };

  // Apply and download cropped image
  const handleCropDownload = async () => {
    if (!imageRef.current || !crop) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = imageRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      // Calculate crop coordinates in pixels
      const cropX = crop.x * scaleX;
      const cropY = crop.y * scaleY;
      const cropWidth = crop.width * scaleX;
      const cropHeight = crop.height * scaleY;

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Apply filters
      ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`;
      
      // Apply transforms
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((filters.rotation * Math.PI) / 180);
      ctx.scale(
        filters.flipHorizontal ? -1 : 1,
        filters.flipVertical ? -1 : 1
      );
      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        -cropWidth / 2, -cropHeight / 2, cropWidth, cropHeight
      );
      ctx.restore();

      // Download
      const link = document.createElement('a');
      link.download = `cropped-${alt || 'image'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setIsCropping(false);
      toast.success('Image cropped and downloaded');
    } catch (error) {
      toast.error('Failed to crop image');
    }
  };

  // Get image style with filters applied
  const getImageStyle = () => ({
    transform: `
      scale(${zoom})
      rotate(${filters.rotation}deg)
      scaleX(${filters.flipHorizontal ? -1 : 1})
      scaleY(${filters.flipVertical ? -1 : 1})
    `,
    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`,
    transition: 'transform 0.1s ease-out, filter 0.1s ease-out',
    maxWidth: `${Math.min(90, 90 * zoom)}vw`,
    maxHeight: `${Math.min(90, 90 * zoom)}vh`,
  });

  // Gallery navigation
  const goToPrevious = () => {
    if (onNavigate && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (onNavigate && currentIndex < galleryImages.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 bg-black/50 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white truncate max-w-[200px]">
            {alt || 'Image'}
          </span>
          {hasGallery && (
            <span className="text-xs text-white/60">
              {currentIndex + 1} / {galleryImages.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-white/10 rounded-md px-1">
            <ToolBtn onClick={handleZoomOut} title="Zoom out" className="text-white/70 hover:text-white">
              <ZoomOut className="h-3.5 w-3.5" />
            </ToolBtn>
            <span className="text-xs text-white/70 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
            <ToolBtn onClick={handleZoomIn} title="Zoom in" className="text-white/70 hover:text-white">
              <ZoomIn className="h-3.5 w-3.5" />
            </ToolBtn>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-0.5 bg-white/10 rounded-md px-1">
            <ToolBtn onClick={() => handleRotate(-90)} title="Rotate left" className="text-white/70 hover:text-white">
              <RotateCcw className="h-3.5 w-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => handleRotate(90)} title="Rotate right" className="text-white/70 hover:text-white">
              <RotateCw className="h-3.5 w-3.5" />
            </ToolBtn>
          </div>

          {/* Filters */}
          <ToolBtn 
            onClick={() => setShowFilters(!showFilters)} 
            title="Filters"
            className={`text-white/70 hover:text-white ${showFilters ? 'bg-white/20 text-white' : ''}`}
          >
            <Palette className="h-4 w-4" />
          </ToolBtn>

          {/* Crop */}
          <ToolBtn 
            onClick={() => setIsCropping(!isCropping)} 
            title="Crop"
            className={`text-white/70 hover:text-white ${isCropping ? 'bg-white/20 text-white' : ''}`}
          >
            <CropIcon className="h-4 w-4" />
          </ToolBtn>

          {/* Gallery view */}
          {hasGallery && (
            <ToolBtn onClick={() => {}} title="Gallery view" className="text-white/70 hover:text-white">
              <Images className="h-4 w-4" />
            </ToolBtn>
          )}

          <div className="h-6 w-px bg-white/20 mx-1" />

          <ToolBtn onClick={toggleFullscreen} title="Fullscreen" className="text-white/70 hover:text-white">
            <Maximize2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={onClose} title="Close" className="text-white/70 hover:text-white">
            <X className="h-4 w-4" />
          </ToolBtn>
        </div>
      </div>

      {/* Main content */}
      <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Image with cropping */}
        {isCropping ? (
          <ReactCrop
            crop={crop}
            onChange={setCrop}
            className="max-w-[90vw] max-h-[90vh]"
            aspect={16 / 9}
          >
            <img
              ref={imageRef}
              src={isOffline ? cachedImageUrl || url : url}
              alt={alt}
              onLoad={handleImageLoad}
              className="max-w-full max-h-[80vh] object-contain"
              style={{
                transform: `scale(${zoom}) rotate(${filters.rotation}deg) scaleX(${filters.flipHorizontal ? -1 : 1}) scaleY(${filters.flipVertical ? -1 : 1})`,
                filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`,
                transition: 'transform 0.15s ease-out, filter 0.15s ease-out',
              }}
            />
          </ReactCrop>
        ) : (
          <div 
            className="flex items-center justify-center overflow-auto"
            style={{ 
              transform: `scale(${zoom}) rotate(${filters.rotation}deg) scaleX(${filters.flipHorizontal ? -1 : 1}) scaleY(${filters.flipVertical ? -1 : 1})`,
              filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`,
              transition: 'transform 0.15s ease-out, filter 0.15s ease-out',
              transformOrigin: 'center center',
            }}
          >
            <img
              ref={imageRef}
              src={isOffline ? cachedImageUrl || url : url}
              alt={alt}
              onLoad={handleImageLoad}
              className="max-w-[90vw] max-h-[90vh] object-contain cursor-grab active:cursor-grabbing"
              onClick={() => setShowFilters(false)}
            />
          </div>
        )}

        {/* Gallery navigation arrows */}
        {hasGallery && (
          <>
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full disabled:opacity-30 hover:bg-black/70 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex === galleryImages.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full disabled:opacity-30 hover:bg-black/70 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

          {/* Filters panel */}
          {showFilters && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/90 rounded-lg p-4 w-80 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white">Adjust Image</span>
                <button onClick={resetFilters} className="text-xs text-white/70 hover:text-white">
                  Reset
                </button>
              </div>

              <div className="space-y-3">
                {/* Brightness */}
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-white/70" />
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={filters.brightness}
                    onChange={(e) => handleFilterChange('brightness', Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-white/70 w-10">{filters.brightness}%</span>
                </div>

                {/* Contrast */}
                <div className="flex items-center gap-2">
                  <Contrast className="h-4 w-4 text-white/70" />
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={filters.contrast}
                    onChange={(e) => handleFilterChange('contrast', Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-white/70 w-10">{filters.contrast}%</span>
                </div>

                {/* Saturation */}
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-white/70" />
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={filters.saturation}
                    onChange={(e) => handleFilterChange('saturation', Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-white/70 w-10">{filters.saturation}%</span>
                </div>
              </div>

            {/* Flip buttons */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/20">
              <button
                onClick={() => handleFlip('horizontal')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs ${filters.flipHorizontal ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
              >
                <FlipHorizontal className="h-3.5 w-3.5" />
                Flip H
              </button>
              <button
                onClick={() => handleFlip('vertical')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs ${filters.flipVertical ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
              >
                <FlipVertical className="h-3.5 w-3.5" />
                Flip V
              </button>
            </div>
          </div>
        )}

        {/* Crop action bar */}
        {isCropping && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/90 rounded-lg px-4 py-2 flex items-center gap-2">
            <button
              onClick={handleCropDownload}
              className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded text-sm hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Crop & Download
            </button>
            <button
              onClick={() => setIsCropping(false)}
              className="text-white/70 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <div className="absolute top-4 right-4 flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">
          <Wifi className="h-3 w-3" />
          Offline mode
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="bg-black/50 border-t border-white/10 px-4 py-2 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">Navigate:</span>
          <span className="text-xs text-white/50">← →</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">Zoom:</span>
          <span className="text-xs text-white/50">+ -</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">Close:</span>
          <span className="text-xs text-white/50">Esc</span>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ 
  children, 
  onClick, 
  title, 
  className = '' 
}: { 
  children: React.ReactNode; 
  onClick: () => void; 
  title: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-md p-1.5 transition-colors hover:bg-white/10 ${className}`}
    >
      {children}
    </button>
  );
}
