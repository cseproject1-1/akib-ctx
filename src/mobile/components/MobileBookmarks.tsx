import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bookmark, 
  X, 
  Trash2, 
  Map,
  ChevronRight
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { useReactFlow, type Viewport } from '@xyflow/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MobileBookmarksProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileBookmarks({ isOpen, onClose }: MobileBookmarksProps) {
  const bookmarks = useCanvasStore((s) => s.bookmarks);
  const removeBookmark = useCanvasStore((s) => s.removeBookmark);
  const { setViewport } = useReactFlow();

  const handleGoToBookmark = (bookmark: typeof bookmarks[0]) => {
    const { x, y, zoom } = bookmark.viewport;
    setViewport({ x, y, zoom }, { duration: 300 });
    toast.success(`Gone to "${bookmark.name}"`);
    onClose();
  };

  const handleDeleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeBookmark(id);
    toast.success('Bookmark deleted');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="w-full max-w-lg bg-background rounded-t-3xl max-h-[70vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Bookmarks</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Bookmarks List */}
          <div className="flex-1 overflow-y-auto p-2">
            {bookmarks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bookmark className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No bookmarks yet</p>
                <p className="text-sm">Save bookmarks to quickly return to locations</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {bookmarks.map((bookmark) => (
                    <motion.div
                      key={bookmark.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border bg-card",
                        "hover:border-primary/50 transition-colors"
                      )}
                      onClick={() => handleGoToBookmark(bookmark)}
                    >
                      <Map className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{bookmark.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Zoom: {Math.round(bookmark.viewport.zoom * 100)}%
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteBookmark(bookmark.id, e)}
                        className="p-2 rounded-full hover:bg-destructive/10 text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
