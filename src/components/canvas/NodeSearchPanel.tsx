import React, { useState, useMemo, useEffect } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useNodes, useReactFlow } from '@xyflow/react';
import { Search, X, Crosshair, Tag, Layers, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function NodeSearchPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'text' | 'media' | 'data'>('all');
  
  const nodes = useNodes();
  const { setCenter } = useReactFlow();

  // Handle hotkey (Ctrl/Cmd + K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredNodes = useMemo(() => {
    if (!query && activeFilter === 'all') return [];
    
    return nodes.filter(n => {
      const data = n.data as any;
      const title = (data.title || data.text || data.fileName || '').toLowerCase();
      const content = (data.content || '').toString().toLowerCase();
      const matchesQuery = title.includes(query.toLowerCase()) || content.includes(query.toLowerCase());
      
      if (!matchesQuery) return false;
      
      if (activeFilter === 'text') return ['stickyNote', 'text', 'lectureNotes', 'aiNote'].includes(n.type || '');
      if (activeFilter === 'media') return ['image', 'video', 'pdf', 'embed', 'bookmark'].includes(n.type || '');
      if (activeFilter === 'data') return ['table', 'spreadsheet', 'kanban', 'checklist', 'calendar'].includes(n.type || '');
      
      return true;
    });
  }, [nodes, query, activeFilter]);

  const handleFlyTo = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setCenter(node.position.x + (node.width || 0) / 2, node.position.y + (node.height || 0) / 2, { zoom: 1.2, duration: 800 });
      setIsOpen(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1100] flex items-start justify-center pt-[10vh] px-4 pointer-events-none">
             {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/40 backdrop-blur-sm pointer-events-auto"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Search Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-[var(--clay-shadow-lg)] pointer-events-auto overflow-hidden flex flex-col max-h-[70vh]"
            >
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input 
                  autoFocus
                  placeholder="Search nodes by title or content..."
                  className="flex-1 bg-transparent border-none outline-none text-sm font-bold placeholder:text-muted-foreground/50"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-[10px] font-black text-muted-foreground uppercase">
                  ESC
                </div>
              </div>

              {/* Filters */}
              <div className="px-4 py-2 border-b-2 border-border bg-muted/30 flex items-center gap-2 overflow-x-auto scrollbar-none">
                <FilterBtn active={activeFilter === 'all'} onClick={() => setActiveFilter('all')}>All</FilterBtn>
                <FilterBtn active={activeFilter === 'text'} onClick={() => setActiveFilter('text')}>Text</FilterBtn>
                <FilterBtn active={activeFilter === 'media'} onClick={() => setActiveFilter('media')}>Media</FilterBtn>
                <FilterBtn active={activeFilter === 'data'} onClick={() => setActiveFilter('data')}>Data</FilterBtn>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {query ? (
                  filteredNodes.length > 0 ? (
                    filteredNodes.map(n => (
                      <button 
                        key={n.id}
                        onClick={() => handleFlyTo(n.id)}
                        className="group w-full flex items-center gap-3 p-3 rounded-xl border-2 border-transparent hover:border-primary hover:bg-primary/5 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-lg border-2 border-border bg-muted flex items-center justify-center text-lg shadow-[2px_2px_0] border-border group-hover:bg-card">
                          {(n.data as any).emoji || '📄'}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="text-xs font-black uppercase tracking-tight truncate">{(n.data as any).title || (n.data as any).text || 'Untitled'}</div>
                           <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">{n.type}</div>
                        </div>
                        <Crosshair className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))
                  ) : (
                    <div className="py-12 text-center text-muted-foreground font-bold italic opacity-50">No results found for "{query}"</div>
                  )
                ) : (
                  <div className="py-12 text-center">
                    <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-40">Start typing to search {nodes.length} nodes</p>
                  </div>
                )}
              </div>
              
              <div className="p-3 border-t-2 border-border bg-muted/50 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase">
                 <span>{nodes.length} nodes in workspace</span>
                 <span className="flex items-center gap-1"><Search className="h-3 w-3" /> Quick Search</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <SearchTrigger onOpen={() => setIsOpen(true)} />
    </>
  );
}

function FilterBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-all",
        active ? "bg-primary border-primary text-primary-foreground shadow-[2px_2px_0_hsl(var(--primary))]" : "bg-card border-border text-muted-foreground hover:border-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

// Global trigger logic
let triggerSearch: () => void = () => {};
export const openSearch = () => triggerSearch();

function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  triggerSearch = onOpen;
  return null;
}
