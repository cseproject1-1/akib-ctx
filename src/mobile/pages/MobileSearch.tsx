import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, FileText, LayoutGrid, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '@/store/canvasStore';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/mobile/layout/MobileLayout';

type SearchType = 'all' | 'nodes' | 'workspaces';

export function MobileSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const nodes = useCanvasStore((s) => s.nodes);
  const workspaces = useCanvasStore((s) => s.openWorkspaces);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('crxnote-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {
        setRecentSearches([]);
      }
    }
  }, []);

  // Save search to recent
  const saveSearch = (newQuery: string) => {
    if (!newQuery.trim()) return;
    
    const updated = [newQuery, ...recentSearches.filter(s => s !== newQuery)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('crxnote-recent-searches', JSON.stringify(updated));
  };

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) return { nodes: [], workspaces: [] };
    
    const q = query.toLowerCase();
    
    const filteredNodes = nodes.filter(node => {
      const data = node.data as any;
      const title = (data?.title || data?.text || '').toLowerCase();
      const type = (node.type || '').toLowerCase();
      return title.includes(q) || type.includes(q);
    });
    
    const filteredWorkspaces = workspaces.filter(ws => 
      ws.name.toLowerCase().includes(q)
    );
    
    return { nodes: filteredNodes, workspaces: filteredWorkspaces };
  }, [query, nodes, workspaces]);

  const handleClear = () => {
    setQuery('');
  };

  const handleSearch = () => {
    if (query.trim()) {
      saveSearch(query);
    }
  };

  const handleWorkspaceClick = (workspaceId: string) => {
    saveSearch(query);
    navigate(`/mobile-mode/workspace/${workspaceId}`);
  };

  const handleNodeClick = (nodeId: string) => {
    saveSearch(query);
    // Find which workspace contains this node and navigate there
    // For now, just show info
    console.log('Node clicked:', nodeId);
  };

  return (
    <MobileLayout title="Search" showBottomNav={true}>
      <div className="h-full flex flex-col bg-background p-4">
        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search workspaces, notes, nodes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full h-12 pl-11 pr-10 rounded-xl bg-accent/40 border-2 border-transparent focus:bg-background focus:border-primary/50 outline-none text-sm transition-all"
            autoFocus
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent/50"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Search Type Tabs */}
        <div className="flex gap-2 mb-4">
          {(['all', 'nodes', 'workspaces'] as SearchType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSearchType(type)}
              className={cn(
                "flex-1 py-2 px-3 rounded-full text-sm font-medium transition-colors",
                searchType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent/30 text-muted-foreground hover:bg-accent/50"
              )}
            >
              {type === 'all' ? 'All' : type === 'nodes' ? 'Nodes' : 'Workspaces'}
            </button>
          ))}
        </div>

        {/* Results or Recent Searches */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {query ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Workspaces Results */}
                {(searchType === 'all' || searchType === 'workspaces') && results.workspaces.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                      Workspaces
                    </h3>
                    {results.workspaces.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => handleWorkspaceClick(workspace.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors text-left"
                      >
                        <div 
                          className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${workspace.color}20` }}
                        >
                          <LayoutGrid className="h-5 w-5" style={{ color: workspace.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{workspace.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Nodes Results */}
                {(searchType === 'all' || searchType === 'nodes') && results.nodes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                      Nodes
                    </h3>
                    {results.nodes.map((node) => {
                      const data = node.data as any;
                      const title = data?.title || data?.text || 'Untitled';
                      
                      return (
                        <button
                          key={node.id}
                          onClick={() => handleNodeClick(node.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors text-left"
                        >
                          <div className="h-10 w-10 rounded-lg bg-accent/30 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* No Results */}
                {results.nodes.length === 0 && results.workspaces.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Search className="h-10 w-10 mb-2 opacity-50" />
                    <p>No results found</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="recent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Recent Searches
                </h3>
                {recentSearches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center px-4">
                    <Search className="h-10 w-10 mb-2 opacity-50" />
                    <p>Your recent searches will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setQuery(search);
                          saveSearch(search);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors text-left"
                      >
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{search}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setRecentSearches([]);
                        localStorage.removeItem('crxnote-recent-searches');
                      }}
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2"
                    >
                      Clear recent searches
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MobileLayout>
  );
}
