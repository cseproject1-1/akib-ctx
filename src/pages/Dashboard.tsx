import { useNavigate } from 'react-router-dom';
import { Plus, Brain, Trash2, LogOut, Loader2, Layers, Star, Search, SortAsc, LayoutGrid, List, Copy, BookOpen, Beaker, Briefcase, Code, Palette, Music, Lightbulb, GraduationCap, Rocket, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { createWorkspace, deleteWorkspace, duplicateWorkspace, type Workspace } from '@/lib/firebase/workspaces';
import { cachedGetWorkspaces, cachedGetNodeCount, invalidateWorkspaceList, invalidateWorkspaceCache, saveNode } from '@/lib/cache/canvasCache';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { canvasTemplates, instantiateTemplate } from '@/lib/canvasTemplates';
import { useCanvasStore } from '@/store/canvasStore';

const WORKSPACE_ICONS: { icon: LucideIcon; label: string; color: string }[] = [
  { icon: LayoutGrid, label: 'Grid', color: '#3b82f6' },
  { icon: BookOpen, label: 'Book', color: '#22c55e' },
  { icon: Beaker, label: 'Science', color: '#8b5cf6' },
  { icon: Briefcase, label: 'Work', color: '#f97316' },
  { icon: Code, label: 'Code', color: '#06b6d4' },
  { icon: Palette, label: 'Art', color: '#ec4899' },
  { icon: Music, label: 'Music', color: '#FACC15' },
  { icon: Lightbulb, label: 'Ideas', color: '#ef4444' },
  { icon: GraduationCap, label: 'Study', color: '#22c55e' },
  { icon: Rocket, label: 'Launch', color: '#8b5cf6' },
];

function getIconForColor(color: string): { icon: LucideIcon; color: string } {
  let hash = 0;
  for (let i = 0; i < color.length; i++) hash = ((hash << 5) - hash + color.charCodeAt(i)) | 0;
  const entry = WORKSPACE_ICONS[Math.abs(hash) % WORKSPACE_ICONS.length];
  return { icon: entry.icon, color: entry.color };
}

type SortMode = 'recent' | 'name' | 'nodes';
type ViewMode = 'grid' | 'list';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('crxnote-favorites') || '[]')); }
    catch { return new Set(); }
  });

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('crxnote-favorites', JSON.stringify([...next]));
      return next;
    });
  };

  const sortedWorkspaces = useMemo(() => {
    let filtered = workspaces.filter((ws) =>
      ws.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const af = favorites.has(a.id) ? 1 : 0;
      const bf = favorites.has(b.id) ? 1 : 0;
      if (af !== bf) return bf - af;
      switch (sortMode) {
        case 'name': return a.name.localeCompare(b.name);
        case 'nodes': return (nodeCounts[b.id] || 0) - (nodeCounts[a.id] || 0);
        default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
  }, [workspaces, searchQuery, sortMode, favorites, nodeCounts]);

  useEffect(() => {
    if (!user) return;
    loadWorkspaces();
  }, [user]);

  const loadWorkspaces = useCallback(async () => {
    try {
      const { cached, fresh } = await cachedGetWorkspaces((freshData) => {
        setWorkspaces(freshData);
        // Refresh node counts incrementally
        freshData.forEach(async (ws) => {
          const count = await cachedGetNodeCount(ws.id);
          setNodeCounts((prev) => ({ ...prev, [ws.id]: count }));
        });
      });

      // Instant render from cache
      if (cached) {
        setWorkspaces(cached);
        setLoading(false);
        // Load cached node counts incrementally
        cached.forEach(async (ws) => {
          const count = await cachedGetNodeCount(ws.id);
          setNodeCounts((prev) => ({ ...prev, [ws.id]: count }));
        });
      }

      // Wait for fresh if no cache
      if (!cached) {
        const data = await fresh;
        setWorkspaces(data);
        data.forEach(async (ws) => {
          const count = await cachedGetNodeCount(ws.id);
          setNodeCounts((prev) => ({ ...prev, [ws.id]: count }));
        });
      }
    } catch (err) {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadWorkspaces();
  }, [user, loadWorkspaces]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const ws = await createWorkspace(newName.trim(), WORKSPACE_ICONS[newIcon].color);
      if (selectedTemplate) {
        const templateNodes = instantiateTemplate(selectedTemplate);
        if (templateNodes.length > 0) {
          // Immediately save template nodes to Firebase so they persist on refresh
          await Promise.all(templateNodes.map(node => saveNode(ws.id, node as any)));
          const { loadCanvas } = useCanvasStore.getState();
          loadCanvas(templateNodes as any[], []);
        }
      }
      navigate(`/workspace/${ws.id}${selectedTemplate ? `?template=${selectedTemplate}` : ''}`);
    } catch (err) {
      toast.error('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, ws: Workspace) => {
    e.stopPropagation();
    try {
      await duplicateWorkspace(ws.id, `${ws.name} (copy)`, ws.color);
      toast.success('Workspace duplicated');
      loadWorkspaces();
    } catch (err) {
      toast.error('Failed to duplicate workspace');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this workspace and all its content?')) return;
    try {
      await deleteWorkspace(id);
      await Promise.all([invalidateWorkspaceList(), invalidateWorkspaceCache(id)]);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      toast.success('Workspace deleted');
    } catch (err) {
      toast.error('Failed to delete workspace');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sortLabel = sortMode === 'recent' ? 'Recent' : sortMode === 'name' ? 'Name' : 'Nodes';
  const nextSort = (): SortMode => sortMode === 'recent' ? 'name' : sortMode === 'name' ? 'nodes' : 'recent';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b-2 border-border px-6 py-4 animate-slide-down">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="ctxnote" className="h-10 w-10 rounded-lg border-2 border-border shadow-[3px_3px_0px_hsl(0,0%,15%)] object-cover" />
            <h1 className="text-xl font-bold uppercase tracking-wider">ctxnote</h1>
          </div>
          <button
            onClick={signOut}
            className="brutal-btn flex items-center gap-2 rounded-lg bg-card px-4 py-2 text-sm font-bold uppercase tracking-wider text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
            <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">Your Workspaces</h2>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="rounded-lg border-2 border-border bg-card pl-9 pr-3 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-primary w-40 sm:w-52"
                />
              </div>
              {/* Sort */}
              <button
                onClick={() => setSortMode(nextSort())}
                className="brutal-btn flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-foreground"
                title={`Sort by: ${sortLabel}`}
              >
                <SortAsc className="h-3.5 w-3.5" />
                {sortLabel}
              </button>
              {/* View toggle */}
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="brutal-btn rounded-lg bg-card p-1.5 text-foreground"
                title={viewMode === 'grid' ? 'List view' : 'Grid view'}
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {!loading && workspaces.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border py-16">
              <Layers className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm font-semibold text-muted-foreground">No workspaces yet. Create one to get started!</p>
              <button
                onClick={() => setShowCreate(true)}
                className="brutal-btn flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                Create Workspace
              </button>
            </div>
          )}

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex h-44 animate-pulse rounded-xl border-2 border-border bg-card" />
              ))}
              {!loading && workspaces.length > 0 && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="group flex h-44 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card transition-all duration-200 hover:border-primary hover:shadow-[4px_4px_0px_hsl(var(--primary))] hover:scale-[1.02] active:scale-[0.98] animate-fade-in"
                >
                  <Plus className="h-8 w-8 text-muted-foreground transition-all duration-200 group-hover:text-primary group-hover:rotate-90" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-primary">
                    New Workspace
                  </span>
                </button>
              )}
              {sortedWorkspaces.map((ws, idx) => (
                <motion.div
                  key={ws.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  className="brutal-card group relative flex h-44 cursor-pointer flex-col justify-between rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-[6px_6px_0px_hsl(0,0%,15%)] active:scale-[0.98]"
                >
                  {(() => {
                    const { icon: WsIcon, color: iconColor } = getIconForColor(ws.color); return (
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-border" style={{ backgroundColor: iconColor + '22' }}>
                          <WsIcon className="h-3.5 w-3.5" style={{ color: iconColor }} />
                        </div>
                        <span className="truncate text-sm font-bold uppercase tracking-wider text-foreground">{ws.name}</span>
                      </div>
                    );
                  })()}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Layers className="h-3 w-3" />
                      {nodeCounts[ws.id] ?? '…'} nodes
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(ws.updated_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="absolute right-3 top-3 flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(ws.id); }}
                      className={`rounded-md p-1.5 transition-all ${favorites.has(ws.id) ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary'}`}
                    >
                      <Star className={`h-4 w-4 ${favorites.has(ws.id) ? 'fill-primary' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => handleDuplicate(e, ws)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:text-primary group-hover:opacity-100"
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, ws.id)}
                      className="rounded-md border-2 border-transparent p-1.5 text-muted-foreground opacity-0 transition-all hover:border-destructive hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            /* List view */
            <div className="space-y-2">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg border-2 border-border bg-card" />
              ))}
              {!loading && workspaces.length > 0 && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-border bg-card px-4 py-3 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-all hover:border-primary hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  New Workspace
                </button>
              )}
              {sortedWorkspaces.map((ws, idx) => (
                <motion.div
                  key={ws.id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  className="brutal-card group flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {(() => {
                    const { icon: WsIcon, color: iconColor } = getIconForColor(ws.color); return (
                      <div className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-border flex-shrink-0" style={{ backgroundColor: iconColor + '22' }}>
                        <WsIcon className="h-3 w-3" style={{ color: iconColor }} />
                      </div>
                    );
                  })()}
                  <span className="flex-1 truncate text-sm font-bold uppercase tracking-wider text-foreground">{ws.name}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{nodeCounts[ws.id] ?? '…'} nodes</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{formatDistanceToNow(new Date(ws.updated_at), { addSuffix: true })}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(ws.id); }} className={`rounded p-1 transition-all ${favorites.has(ws.id) ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'}`}>
                      <Star className={`h-3.5 w-3.5 ${favorites.has(ws.id) ? 'fill-primary' : ''}`} />
                    </button>
                    <button onClick={(e) => handleDuplicate(e, ws)} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary" title="Duplicate">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={(e) => handleDelete(e, ws.id)} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create workspace modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border-2 border-border bg-card p-6 shadow-[6px_6px_0px_hsl(0,0%,15%)] animate-brutal-pop">
            <h3 className="mb-4 text-lg font-bold uppercase tracking-wider text-foreground">New Workspace</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-foreground">Name</label>
                <input
                  className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Study Board"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-foreground">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {WORKSPACE_ICONS.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => setNewIcon(idx)}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${newIcon === idx ? 'scale-110 border-primary bg-primary/10 shadow-[2px_2px_0px_hsl(var(--primary)/0.4)]' : 'border-border hover:scale-105 hover:border-foreground'}`}
                        title={item.label}
                      >
                        <IconComp className="h-4.5 w-4.5" style={{ color: item.color }} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-foreground">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className={`rounded-lg border-2 px-3 py-2 text-left text-xs font-bold transition-all ${selectedTemplate === null ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground'}`}
                  >
                    ✨ Blank
                  </button>
                  {canvasTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`rounded-lg border-2 px-3 py-2 text-left text-xs font-bold transition-all ${selectedTemplate === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground'}`}
                    >
                      {t.emoji} {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowCreate(false); setSelectedTemplate(null); }}
                  className="brutal-btn rounded-lg bg-card px-4 py-2 text-sm font-bold uppercase text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="brutal-btn flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
