import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  FolderOpen, 
  Trash2,
  LayoutGrid,
  BookOpen,
  Beaker,
  Briefcase,
  Code,
  Palette,
  Music,
  Lightbulb,
  GraduationCap,
  Rocket,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cachedGetWorkspaces, invalidateWorkspaceList } from '@/lib/cache/canvasCache';
import { createWorkspace, deleteWorkspace, type Workspace } from '@/lib/firebase/workspaces';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/mobile/layout/MobileLayout';
import { useMobileTheme } from '@/mobile/layout/MobileDrawer';
import { WorkspaceCardSkeleton } from '@/mobile/components/MobileLoadingSkeleton';

const WORKSPACE_ICONS = [
  { icon: LayoutGrid, color: '#3b82f6', label: 'Grid' },
  { icon: BookOpen, color: '#22c55e', label: 'Book' },
  { icon: Beaker, color: '#8b5cf6', label: 'Science' },
  { icon: Briefcase, color: '#f97316', label: 'Work' },
  { icon: Code, color: '#06b6d4', label: 'Code' },
  { icon: Palette, color: '#ec4899', label: 'Art' },
  { icon: Music, color: '#FACC15', label: 'Music' },
  { icon: Lightbulb, color: '#ef4444', label: 'Ideas' },
  { icon: GraduationCap, color: '#22c55e', label: 'Study' },
  { icon: Rocket, color: '#8b5cf6', label: 'Launch' },
];

function getIconForColor(color: string) {
  let hash = 0;
  for (let i = 0; i < color.length; i++) hash = ((hash << 5) - hash + color.charCodeAt(i)) | 0;
  const entry = WORKSPACE_ICONS[Math.abs(hash) % WORKSPACE_ICONS.length];
  return entry;
}

// Haptic feedback helper
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[type]);
  }
};

export function MobileDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useMobileTheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Pull-to-refresh state
  const touchStartY = useRef(0);
  const touchDeltaY = useRef(0);
  const [refreshY, setRefreshY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      const { cached, fresh } = await cachedGetWorkspaces((freshData) => {
        setWorkspaces(freshData);
      });

      if (cached) {
        setWorkspaces(cached);
        setLoading(false);
      }

      if (!cached) {
        const data = await fresh;
        setWorkspaces(data);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await invalidateWorkspaceList();
      await loadWorkspaces();
      // Silent mode - visual feedback shows refresh
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
      setRefreshY(0);
      setIsPulling(false);
    }
  }, [loadWorkspaces]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const scrollContainer = target.closest('.scroll-container');
    
    if (scrollContainer && scrollContainer.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      const pullDistance = Math.min(deltaY * 0.5, 120);
      setRefreshY(pullDistance);
      touchDeltaY.current = deltaY;
    }
  };

  const handleTouchEnd = () => {
    if (isPulling && touchDeltaY.current > 100) {
      handleRefresh();
    } else {
      setRefreshY(0);
      setIsPulling(false);
    }
    touchDeltaY.current = 0;
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      // Silent mode - validation handled by UI
      return;
    }

    try {
      const icon = WORKSPACE_ICONS[selectedIcon];
      const workspace = await createWorkspace(newWorkspaceName.trim(), icon.color);
      setNewWorkspaceName('');
      setShowCreateModal(false);
      triggerHaptic('medium');
      navigate(`/mobile-mode/workspace/${workspace.id}`);
      // Silent mode - navigation shows success
    } catch (error) {
      console.error('Failed to create workspace:', error);
      // Silent mode - error is logged, user can retry
    }
  };

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    try {
      await deleteWorkspace(workspace.id);
      setWorkspaces(prev => prev.filter(w => w.id !== workspace.id));
      triggerHaptic('heavy');
      // Silent mode - visual feedback shows deletion
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      // Silent mode - error is logged
    }
  };

  const filteredWorkspaces = workspaces.filter(ws => 
    ws.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MobileLayout title="CtxNote">
      <div 
        className="h-full flex flex-col bg-background scroll-container"
        data-mobile-dashboard
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Pull to Refresh Indicator */}
        <AnimatePresence>
          {(refreshY > 0 || isRefreshing) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex justify-center py-2"
            >
              <motion.div
                animate={{ rotate: isRefreshing ? 360 : 0 }}
                transition={{ duration: isRefreshing ? 1 : 0 }}
                style={{ 
                  transform: `translateY(${isRefreshing ? 0 : refreshY / 2 - 20}px)` 
                }}
              >
                <RefreshCw className={cn(
                  "h-5 w-5",
                  isRefreshing ? "text-primary animate-spin" : "text-muted-foreground"
                )} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Bar */}
        <div className="p-4 pb-2 pt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-accent/40 border-2 border-transparent focus:bg-background focus:border-primary/50 outline-none text-sm transition-all"
            />
          </div>
        </div>

        {/* Workspaces List */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-2">
          {loading ? (
            <div className="space-y-3 py-2">
              <WorkspaceCardSkeleton />
              <WorkspaceCardSkeleton />
              <WorkspaceCardSkeleton />
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
              <p>No workspaces yet</p>
              <p className="text-sm">Create your first workspace to get started</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <AnimatePresence mode="popLayout">
                {filteredWorkspaces.map((workspace) => {
                  const iconInfo = getIconForColor(workspace.color);
                  const Icon = iconInfo.icon;
                  
                  return (
                    <motion.div
                      key={workspace.id}
                      layout
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="group"
                    >
                      <button
                        onClick={() => {
                          triggerHaptic('light');
                          navigate(`/mobile-mode/workspace/${workspace.id}`);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-card border-2 border-border rounded-2xl hover:border-primary/50 transition-all active:scale-[0.98] touch-pan-y"
                      >
                        {/* Icon */}
                        <div 
                          className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: `${iconInfo.color}20`, color: iconInfo.color }}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0 text-left">
                          <h3 className="font-semibold text-foreground truncate">
                            {workspace.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {workspace.updated_at ? new Date(workspace.updated_at).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div
                              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-destructive/10 cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteWorkspace(workspace);
                              }}
                              aria-label="Delete workspace"
                              role="button"
                              tabIndex={0}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </div>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Floating Action Button */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            triggerHaptic('light');
            setShowCreateModal(true);
          }}
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg shadow-primary/30 bg-primary text-primary-foreground z-50 flex items-center justify-center"
          aria-label="Create workspace"
        >
          <Plus className="h-6 w-6" />
        </motion.button>
      </div>

      {/* Create Workspace Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-background rounded-t-3xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-4">Create New Workspace</h2>
              
              <input
                type="text"
                placeholder="Workspace name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-accent/40 border-2 border-transparent focus:border-primary/50 outline-none mb-4"
                autoFocus
              />

              <p className="text-sm text-muted-foreground mb-2">Choose an icon</p>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-6 px-6">
                {WORKSPACE_ICONS.map((icon, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedIcon(index);
                      triggerHaptic('light');
                    }}
                    className={cn(
                      "flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center transition-all",
                      selectedIcon === index 
                        ? "ring-2 ring-primary ring-offset-2" 
                        : "bg-accent/30 hover:bg-accent/50"
                    )}
                    style={{ color: icon.color }}
                  >
                    <icon.icon className="h-5 w-5" />
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateWorkspace}
                >
                  Create
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MobileLayout>
  );
}
