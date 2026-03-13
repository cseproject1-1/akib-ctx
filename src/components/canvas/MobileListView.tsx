import { useCanvasStore } from '@/store/canvasStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import { 
  FileText, BookOpen, Book, CheckSquare, Image as ImageIcon, Code2, 
  Link, FileDigit, List, X, ChevronRight, Video, Bookmark, 
  Calendar, Paperclip, Table, HelpCircle, Columns3, Search, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Node } from '@xyflow/react';
import { Virtuoso } from 'react-virtuoso';

const ICON_MAP: Record<string, any> = {
  aiNote: FileText,
  lectureNotes: BookOpen,
  summary: Book,
  checklist: CheckSquare,
  image: ImageIcon,
  codeSnippet: Code2,
  embed: Link,
  math: FileDigit,
  text: FileText,
  kanban: Columns3,
  table: Table,
  termQuestion: HelpCircle,
  stickyNote: FileText,
  pdf: FileText,
  flashcard: Bookmark,
  video: Video,
  bookmark: Bookmark,
  calendar: Calendar,
  fileAttachment: Paperclip,
  spreadsheet: Table,
};

function extractText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  if (Array.isArray(content)) return content.map(extractText).join(' ');
  if (content.content) return extractText(content.content);
  return '';
}

function extractContentPreview(node: Node): string {
  const data = node.data as any;
  if (!data.content) {
    if (data.text) return data.text;
    if (data.url) return data.url;
    return '';
  }
  
  const text = extractText(data.content);
  return text.trim().slice(0, 120);
}

export function MobileListView() {
  const nodes = useCanvasStore((s) => s.nodes);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const types = new Set(nodes.map(n => n.type));
    return ['all', ...Array.from(types).filter(Boolean)] as string[];
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const title = ((node.data as any).title || (node.data as any).text || '').toLowerCase();
      const type = (node.type || '').toLowerCase();
      const matchesSearch = title.includes(searchQuery.toLowerCase()) || type.includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || node.type === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [nodes, searchQuery, activeCategory]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[100] bg-background p-4 flex flex-col gap-4 overflow-hidden"
    >
      <div className="flex flex-col gap-4 border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">Content Explorer</h2>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="p-1.5 rounded-lg bg-accent/50 text-muted-foreground active:rotate-180 transition-transform duration-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>



        {/* Search Bar */}
        <div className="relative group">
          <input
            type="text"
            placeholder="Find what you need..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 px-4 pl-11 rounded-2xl bg-accent/40 border-2 border-transparent focus:bg-background focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none text-[13px] transition-all placeholder:text-muted-foreground/50"
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          <div className="shrink-0 p-1.5 rounded-lg bg-accent/20">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border",
                activeCategory === cat 
                  ? "bg-primary border-primary text-primary-foreground shadow-md" 
                  : "bg-accent/30 border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {cat === 'all' ? 'Everything' : cat.replace(/([A-Z])/g, ' $1')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 pr-1">
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground italic gap-2">
            <div className="h-12 w-12 rounded-full bg-accent/30 flex items-center justify-center">
              <X className="h-6 w-6 opacity-20" />
            </div>
            <p className="text-sm">No matches found</p>
          </div>
        ) : (
          <Virtuoso
            data={filteredNodes}
            className="custom-scrollbar"
            itemContent={(idx, node: Node) => {
              const Icon = ICON_MAP[node.type || 'text'] || FileText;
              const title = (node.data as any).title || (node.data as any).text || 'Untitled Item';
              const preview = extractContentPreview(node);
              
              return (
                <div className="pb-3">
                  <button
                    onClick={() => setExpandedNode(node.id)}
                    className="w-full flex flex-col p-4 rounded-2xl border-2 border-border bg-card hover:border-primary/50 transition-all text-left group active:shadow-inner"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <h3 className="font-bold text-[13px] text-foreground truncate">{title}</h3>
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest leading-none">
                            {node.type?.replace(/([A-Z])/g, ' $1')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1 duration-300" />
                    </div>
                    
                    {preview && (
                      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed ml-[52px] italic border-l-2 border-border pl-3 mt-1">
                        {preview}
                      </p>
                    )}
                  </button>
                </div>
              );
            }}
          />
        )}
      </div>
      
      <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 text-[10px] text-primary/70 font-bold uppercase tracking-widest text-center mb-16">
        Tap content to view details • Switch views using the bottom menu
      </div>
    </motion.div>
  );
}
