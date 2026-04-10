import { useReactFlow, Panel, useStore, useNodes, useEdges } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, Undo2, Redo2, ArrowLeft, Save, CheckCircle, AlertCircle, FileDown, Paintbrush, Share2, Eye, EyeOff, MousePointerClick, Presentation, Crosshair, LayoutDashboard, Grid3X3, Lock, Unlock, Trash2, Magnet, Cable, FileText, FileJson, Clock, GitBranch, CloudOff, Sparkles, Upload, Network, Orbit, LayoutGrid, Search, Map as MapIcon, BookmarkPlus, X, History, Pen, Edit2, Maximize2, Minimize2, Keyboard, Zap, ZapOff, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getTreeLayout, getCircularLayout } from '@/lib/canvas/layoutUtils';
import { ThemeToggle } from './ThemeToggle';
import { useCanvasStore } from '@/store/canvasStore';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { updateWorkspace } from '@/lib/firebase/workspaces';
import { invalidateWorkspaceList } from '@/lib/cache/canvasCache';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import { exportToMarkdown, exportToPlainText, exportToJSON, exportToZip, importFromMarkdown, importFromZip } from '@/lib/exportCanvas';
import { toast } from 'sonner';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShareWorkspaceModal } from './ShareWorkspaceModal';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { BranchDialog } from './BranchDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { usePendingOpsCount } from '@/hooks/usePendingOpsCount';
import { replayPendingOps } from '@/lib/cache/canvasCache';
import { NodeSearchPanel, openSearch } from './NodeSearchPanel';
import { TemplateGallery } from './TemplateGallery';
import { HistoryPanel, openHistory } from './HistoryPanel';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function CanvasToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const drawingMode = useCanvasStore((s) => s.drawingMode);
  const setDrawingMode = useCanvasStore((s) => s.setDrawingMode);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const past = useCanvasStore((s) => s.past);
  const future = useCanvasStore((s) => s.future);
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const workspaceName = useCanvasStore((s) => s.workspaceName);
  const workspaceColor = useCanvasStore((s) => s.workspaceColor);
  const saveStatus = useCanvasStore((s) => s.saveStatus);
  const lastSavedAt = useCanvasStore((s) => s.lastSavedAt);
  const nodes = useNodes();
  const edges = useEdges();
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const toggleCanvasMode = useCanvasStore((s) => s.toggleCanvasMode);
  const focusMode = useCanvasStore((s) => s.focusMode);
  const toggleFocusMode = useCanvasStore((s) => s.toggleFocusMode);
  const zenMode = useCanvasStore((s) => s.zenMode);
  const toggleZenMode = useCanvasStore((s) => s.toggleZenMode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setExportProgress = useCanvasStore((s) => s.setExportProgress);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const toggleSnap = useCanvasStore((s) => s.toggleSnap);
  const gridStyle = useCanvasStore((s) => s.gridStyle);
  const cycleGridStyle = useCanvasStore((s) => s.cycleGridStyle);
  const allLocked = useCanvasStore((s) => s.allLocked);
  const toggleLockAll = useCanvasStore((s) => s.toggleLockAll);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const connectMode = useCanvasStore((s) => s.connectMode);
  const setConnectMode = useCanvasStore((s) => s.setConnectMode);
  const versionHistoryOpen = useCanvasStore((s) => s.versionHistoryOpen);
  const setVersionHistoryOpen = useCanvasStore((s) => s.setVersionHistoryOpen);
  const zoomOnScroll = useCanvasStore((s) => s.zoomOnScroll);
  const toggleZoomOnScroll = useCanvasStore((s) => s.toggleZoomOnScroll);
  const setWorkspaceMeta = useCanvasStore((s) => s.setWorkspaceMeta);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const importNodesAction = useCanvasStore((s) => s.importNodes);
  const tidyUp = useCanvasStore((s) => s.tidyUp);
  const pushSnapshot = useCanvasStore((s) => s.pushSnapshot);
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [parentWorkspaceId, setParentWorkspaceId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [lastSavedLabel, setLastSavedLabel] = useState('');
  const pendingCount = usePendingOpsCount();
  const showMinimap = useCanvasStore((s) => s.showMinimap);
  const toggleMinimap = useCanvasStore((s) => s.toggleMinimap);
  const bookmarks = useCanvasStore((s) => s.bookmarks);
  const addBookmark = useCanvasStore((s) => s.addBookmark);
  const removeBookmark = useCanvasStore((s) => s.removeBookmark);
  const { getViewport, setViewport } = useReactFlow();
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const setAISynthesisOpen = useCanvasStore((s) => s.setAISynthesisOpen);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { isOnline } = useNetworkStatus();
  const enableHybridEditor = useSettingsStore((s) => s.enableHybridEditor);
  const setHybridEditorEnabled = useSettingsStore((s) => s.setHybridEditorEnabled);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
        setShowLayoutMenu(false);
        setShowBookmarks(false);
      }
    };
    if (showExportMenu || showLayoutMenu || showBookmarks) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu, showLayoutMenu, showBookmarks]);

  // Keyboard shortcut to close menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.querySelector('[role="dialog"][data-state="open"]')) return;
        setShowExportMenu(false);
        setShowLayoutMenu(false);
        setShowBookmarks(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Update "last saved" label every 30s
  useEffect(() => {
    const update = () => {
      if (lastSavedAt) {
        setLastSavedLabel(formatDistanceToNow(lastSavedAt, { addSuffix: true }));
      }
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  const zoom = useStore((s) => s.transform[2]);
  const zoomPercent = Math.max(0, Math.round(zoom * 100));

  const selectedCount = nodes.filter((n) => n.selected).length;

  const handleRenameWorkspace = async () => {
    if (!workspaceId) return;
    const newName = prompt('Enter new workspace name:', workspaceName);
    if (!newName || !newName.trim() || newName.trim() === workspaceName) return;

    try {
      await updateWorkspace(workspaceId, { name: newName.trim() });
      await invalidateWorkspaceList();
      setWorkspaceMeta(newName.trim(), workspaceColor);
      toast.success('Workspace renamed');
    } catch (err) {
      toast.error('Failed to rename workspace');
    }
  };

  const handleExportMd = async (fullFidelity = false) => {
    setShowExportMenu(false);
    setExportProgress(10);
    // Simulate some "prep" time for polish
    await new Promise(r => setTimeout(r, 400));
    setExportProgress(40);
    exportToMarkdown(nodes, workspaceName, fullFidelity);
    setExportProgress(80);
    await new Promise(r => setTimeout(r, 300));
    setExportProgress(100);
    setTimeout(() => setExportProgress(null), 500);
    toast.success(`Exported to Markdown${fullFidelity ? ' (Full Fidelity)' : ''}`);
  };

  const handleExportZip = async (selectedOnly = false) => {
    const nodesToExport = selectedOnly ? nodes.filter(n => n.selected) : nodes;
    const edgesToExport = selectedOnly ? edges.filter(e => {
      const source = nodes.find(n => n.id === e.source);
      const target = nodes.find(n => n.id === e.target);
      return source?.selected && target?.selected;
    }) : edges;

    if (nodesToExport.length === 0) {
      toast.error('No nodes selected to export');
      return;
    }

    setShowExportMenu(false);
    setExportProgress(10);
    await new Promise(r => setTimeout(r, 500));
    setExportProgress(30);
    
    await exportToZip(nodesToExport, edgesToExport, workspaceName);
    
    setExportProgress(70);
    await new Promise(r => setTimeout(r, 400));
    setExportProgress(100);
    setTimeout(() => setExportProgress(null), 500);
    
    toast.success(`Exported ${selectedOnly ? 'Selection' : 'Workspace'} to ZIP`);
  };
  const handleExportTxt = () => { exportToPlainText(nodes, workspaceName); toast.success('Exported to Plain Text'); setShowExportMenu(false); };
  const handleExportJson = () => { exportToJSON(nodes, workspaceName); toast.success('Exported to JSON'); setShowExportMenu(false); };

  const handleGridLayout = () => {
    const nodesToLayout = nodes.filter(n => !n.data?.locked);
    if (nodesToLayout.length === 0) return;
    
    pushSnapshot('Grid Layout');
    
    const cols = Math.ceil(Math.sqrt(nodesToLayout.length));
    const gapX = 440;
    const gapY = 560;
    
    const layoutMap = new Map();
    nodesToLayout.forEach((n, index) => {
      layoutMap.set(n.id, {
        x: (index % cols) * gapX,
        y: Math.floor(index / cols) * gapY,
      });
    });

    const newNodes = nodes.map((n) => {
      const pos = layoutMap.get(n.id);
      if (!pos) return n;
      return { ...n, position: pos };
    });
    
    setNodes(newNodes);
    setTimeout(() => fitView({ duration: 400 }), 50);
    toast.success('Grid layout applied');
    setShowLayoutMenu(false);
  };

  const handleTreeLayout = () => {
    const nodesToLayout = nodes.filter(n => !n.data?.locked);
    if (nodesToLayout.length === 0) return;
    
    pushSnapshot('Tree Layout');
    const newNodes = getTreeLayout(nodesToLayout, edges);
    
    const layoutMap = new Map(newNodes.map(n => [n.id, n.position]));
    const resultNodes = nodes.map(n => ({
      ...n,
      position: n.data?.locked ? n.position : (layoutMap.get(n.id) || n.position)
    }));
    
    setNodes(resultNodes);
    setTimeout(() => fitView({ duration: 400 }), 50);
    toast.success('Tree layout applied');
    setShowLayoutMenu(false);
  };

  const handleCircularLayout = () => {
    const nodesToLayout = nodes.filter(n => !n.data?.locked);
    if (nodesToLayout.length === 0) return;
    
    pushSnapshot('Circular Layout');
    const newNodes = getCircularLayout(nodesToLayout);
    
    const layoutMap = new Map(newNodes.map(n => [n.id, n.position]));
    const resultNodes = nodes.map(n => ({
      ...n,
      position: n.data?.locked ? n.position : (layoutMap.get(n.id) || n.position)
    }));
    
    setNodes(resultNodes);
    setTimeout(() => fitView({ duration: 400 }), 50);
    toast.success('Circular layout applied');
    setShowLayoutMenu(false);
  };

  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          
          if (Array.isArray(data) || (data && typeof data === 'object')) {
            const importedNodes = Array.isArray(data) ? data : (Array.isArray(data.nodes) ? data.nodes : []);
            const importedEdges = data && typeof data === 'object' && Array.isArray(data.edges) ? data.edges : [];
            
            if (importedNodes.length === 0) {
              toast.error('No nodes found in JSON');
              return;
            }

            // Re-map IDs to prevent collisions
            const idMap = new Map<string, string>();
            const remappedNodes = importedNodes.map(n => {
              const newId = crypto.randomUUID();
              idMap.set(n.id, newId);
              return { ...n, id: newId };
            });

            // Filter and remap edges
            const nodeIds = new Set(importedNodes.map(n => n.id));
            const remappedEdges = importedEdges
              .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
              .map(e => ({
                ...e,
                id: crypto.randomUUID(),
                source: idMap.get(e.source)!,
                target: idMap.get(e.target)!,
              }));
            
            loadCanvas([...nodes, ...remappedNodes], [...edges, ...remappedEdges]);
            toast.success(`Imported ${remappedNodes.length} nodes ${remappedEdges.length > 0 ? `and ${remappedEdges.length} edges` : ''} successfully!`);
          } else {
            toast.error('Invalid JSON structure.');
          }
        } catch (err) {
          toast.error('Failed to parse JSON file');
          console.error(err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setShowExportMenu(false);
  };

  const handleImportMarkdown = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const node = await importFromMarkdown(file);
        if (node) {
          importNodesAction([node]);
          toast.success('Markdown imported successfully!');
        }
      } catch (err) {
        toast.error('Failed to import Markdown');
      }
    };
    input.click();
    setShowExportMenu(false);
  };

  const handleImportZip = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const { nodes: newNodes, edges: newEdges } = await importFromZip(file);
        if (newNodes.length > 0) {
          const idMap = new Map<string, string>();
          const remappedNodes = newNodes.map(n => {
            const newId = crypto.randomUUID();
            idMap.set(n.id, newId);
            return { ...n, id: newId };
          });
          const remappedEdges = newEdges
            .filter(e => idMap.has(e.source) && idMap.has(e.target))
            .map(e => ({
              ...e,
              id: crypto.randomUUID(),
              source: idMap.get(e.source)!,
              target: idMap.get(e.target)!,
            }));

          loadCanvas([...nodes, ...remappedNodes], [...edges, ...remappedEdges]);
          toast.success(`Imported ${remappedNodes.length} nodes and ${remappedEdges.length} edges from ZIP!`);
        }
      } catch (err) {
        toast.error('Failed to import ZIP');
        console.error(err);
      }
    };
    input.click();
    setShowExportMenu(false);
  };

  const gridLabel = {
    dots: 'Dots',
    lines: 'Lines',
    cross: 'Cross',
    graph: 'Graph',
    blank: 'Blank'
  }[gridStyle];

  return (
    <TooltipProvider delayDuration={300}>
      <Panel position="top-left" className="w-full sm:max-w-[calc(100%-60px)]">
        <div ref={menuRef} className="flex flex-wrap items-center gap-2 animate-slide-down">
          <TipBtn tip="Back to Dashboard" onClick={() => { setShowExportMenu(false); navigate('/'); }} className="pro-btn rounded-xl glass-effect p-2.5 text-foreground/60 transition-all hover:text-primary hover:border-primary/20 hover:bg-primary/5">
            <ArrowLeft className="h-4 w-4" />
          </TipBtn>
          <div className="h-4 w-px bg-white/5 mx-0.5" />
          <WorkspaceSwitcher
            currentId={workspaceId || ''}
            currentName={workspaceName}
            currentColor={workspaceColor}
          />
          <TipBtn tip="Rename Workspace" onClick={handleRenameWorkspace} className="pro-btn rounded-xl glass-effect p-2.5 text-muted-foreground/60 transition-all hover:text-primary hover:border-primary/20 hover:bg-primary/5">
            <Edit2 className="h-4 w-4" />
          </TipBtn>
          {/* Premium Sync Status Indicator - "Pro" Approach */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-1.5 rounded-xl border border-white/5 glass-morphism-light px-3 py-2 cursor-help transition-all duration-300 hover:border-primary/30 hover:bg-primary/5",
                !isOnline ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' :
                saveStatus === 'saved' ? 'text-primary' : saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground/40'
              )}>
                {!isOnline && <WifiOff className="h-3.5 w-3.5" />}
                {isOnline && saveStatus === 'saving' && <Save className="h-3.5 w-3.5 animate-pulse" />}
                {isOnline && (saveStatus === 'saved' || saveStatus === 'idle') && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    key="saved-icon"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  </motion.div>
                )}
                {isOnline && saveStatus === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
                
                {/* Minimalist label - only show "Saving" when active, otherwise let tooltip handle "Saved X ago" */}
                <AnimatePresence mode="wait">
                  {saveStatus === 'saving' && !isMobile && (
                    <motion.span 
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 5 }}
                      className="text-[9px] font-bold uppercase tracking-wider pt-0.5"
                    >
                      Saving
                    </motion.span>
                  )}
                  {saveStatus === 'saved' && !isMobile && (
                    <motion.span 
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[9px] font-medium text-primary/60 tracking-wide pt-0.5"
                    >
                      Synced
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="premium-tooltip" sideOffset={8}>
              {!isOnline 
                ? 'Offline — Changes saved to local cache' 
                : saveStatus === 'saved' 
                  ? `Everything synced ${lastSavedLabel ? `· ${lastSavedLabel}` : ''}`
                  : saveStatus === 'saving' 
                    ? 'Syncing changes to cloud...' 
                    : saveStatus === 'error' 
                      ? 'Sync error — check your connection' 
                      : 'Idle'}
            </TooltipContent>
          </Tooltip>

          <TipBtn
            tip={pendingCount > 0 ? `${pendingCount} unsynced change${pendingCount > 1 ? 's' : ''} — click to sync now` : "All changes synced to cloud"}
            onClick={() => { replayPendingOps(); toast.info('Forcing sync…'); }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
              pendingCount > 0 
                ? "bg-destructive/10 border border-destructive/20 text-destructive animate-pulse hover:bg-destructive/15" 
                : "glass-effect text-muted-foreground/30 hover:text-primary hover:bg-primary/5 hover:border-primary/20"
            )}
          >
            {pendingCount > 0 ? <CloudOff className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
            {pendingCount > 0 && <span>{pendingCount}</span>}
          </TipBtn>
          <div className="h-4 w-px bg-white/5 mx-0.5" />
          <TipBtn tip="Share workspace" onClick={() => setShareOpen(true)} className="pro-btn flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95">
            <Share2 className="h-3.5 w-3.5 fill-primary-foreground/20" />
            {!isMobile && <span className="pt-0.5">Share</span>}
          </TipBtn>
          <TipBtn tip="Version history" onClick={() => setVersionHistoryOpen(!versionHistoryOpen)} className={cn("pro-btn flex items-center gap-2 rounded-xl px-2.5 py-2 text-[10px] font-black uppercase tracking-widest transition-all glass-effect", versionHistoryOpen ? "text-primary border-primary/20 bg-primary/5" : "text-muted-foreground/60 hover:text-foreground")}>
            <Clock className="h-3.5 w-3.5" />
          </TipBtn>
          <TipBtn tip="Branch" onClick={() => setBranchOpen(true)} className="pro-btn flex items-center gap-2 rounded-xl glass-effect px-2.5 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 transition-all hover:text-foreground mr-2">
            <GitBranch className="h-3.5 w-3.5" />
          </TipBtn>
          <div className="h-4 w-px bg-white/5 mx-0.5" />
          <TipBtn tip="Keyboard Shortcuts (/)" onClick={() => setShowShortcuts(true)} className="pro-btn flex items-center gap-2 rounded-xl glass-effect px-2.5 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 transition-all hover:text-foreground">
            <Keyboard className="h-3.5 w-3.5" />
          </TipBtn>
        </div>
      </Panel>

      {showShortcuts && <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />}

      {shareOpen && workspaceId && (
        <ShareWorkspaceModal
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onClose={() => setShareOpen(false)}
        />
      )}

      {versionHistoryOpen && <VersionHistoryPanel />}

      {branchOpen && (
        <BranchDialog
          onClose={() => setBranchOpen(false)}
          parentWorkspaceId={parentWorkspaceId}
        />
      )}

      <Panel position="bottom-center" className="mb-6 !max-w-[calc(100%-24px)]">
        <div id="canvas-toolbar" className="flex items-center gap-1 rounded-2xl toolbar-glass p-2 overflow-x-auto overflow-y-hidden scrollbar-none animate-toolbar-appear">
          <ToolbarBtn onClick={() => undo()} disabled={past.length === 0} tip="Undo (⌘Z)">
            <Undo2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => redo()} disabled={future.length === 0} tip="Redo (⌘⇧Z)">
            <Redo2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => openHistory()} tip="Action History (H)">
            <History className="h-4 w-4" />
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={() => zoomOut()} disabled={zoom <= 0.15} tip="Zoom out (⌘−)">
            <ZoomOut className="h-4 w-4" />
          </ToolbarBtn>
          <span className="w-12 text-center text-[10px] font-black text-primary/80 tabular-nums flex-shrink-0 tracking-widest">{zoomPercent}%</span>
          <ToolbarBtn onClick={() => zoomIn()} disabled={zoom >= 2} tip="Zoom in (⌘+)">
            <ZoomIn className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => fitView({ duration: 300 })} tip="Fit view (⌘⇧H)">
            <Maximize className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={toggleFullscreen} tip={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen (F11)'} className={cn(isFullscreen && "text-primary bg-primary/5")}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={() => setDrawingMode(!drawingMode)} tip="Drawing mode (D)" className={cn(drawingMode ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-primary/10')}>
            <Pen className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => { const newMode = !connectMode; setConnectMode(newMode); if (newMode) toast.info('Connector mode: click the source node'); }} tip="Connector mode (C)" className={cn(connectMode ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-primary/10')}>
            <Cable className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={toggleCanvasMode} tip={canvasMode === 'edit' ? 'Switch to view mode (V)' : 'Switch to edit mode (V)'} className={cn(canvasMode === 'view' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-primary/10')}>
            {canvasMode === 'view' ? <Eye className="h-4 w-4" /> : <MousePointerClick className="h-4 w-4" />}
          </ToolbarBtn>
          <ToolbarBtn onClick={toggleFocusMode} tip="Focus mode (F)" className={cn(focusMode ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-primary/10')}>
            <Crosshair className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={toggleZenMode} tip="Zen Mode (Z) - Hide all tools" className={cn(zenMode ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-primary/10')}>
            <EyeOff className="h-4 w-4" />
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={toggleSnap} tip={`Snap to grid: ${snapEnabled ? 'ON' : 'OFF'} (S)`} className={cn(snapEnabled ? 'text-primary bg-primary/5 border border-primary/20' : 'hover:bg-primary/10')}>
            <Magnet className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={cycleGridStyle} tip={`Grid style: ${gridLabel} (G)`}>
            <Grid3X3 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={toggleZoomOnScroll} tip={zoomOnScroll ? 'Switch to Pan Mode (Scroll to Pan)' : 'Switch to Zoom Mode (Scroll to Zoom)'} className={cn(!zoomOnScroll && 'text-primary bg-primary/5 border border-primary/20')}>
            {zoomOnScroll ? <MousePointerClick className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </ToolbarBtn>
          <ToolbarBtn onClick={() => toggleLockAll()} tip={allLocked ? 'Unlock all nodes (L)' : 'Lock all nodes (L)'} className={cn(allLocked ? 'text-primary bg-primary/5 border border-primary/20' : 'hover:bg-primary/10')}>
            {allLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </ToolbarBtn>
          {selectedCount > 1 && (
            <ToolbarBtn 
              onClick={() => setAISynthesisOpen(true)} 
              tip={`Ask AI about ${selectedCount} selected nodes`}
              className="bg-primary/10 text-primary border-x border-primary/20 px-4 group"
            >
              <Sparkles className="h-4 w-4 group-hover:animate-spin-slow" />
              <span className="ml-2 text-[10px] font-black uppercase tracking-widest">Ask AI</span>
            </ToolbarBtn>
          )}
          {selectedCount > 0 && (
            <ToolbarBtn onClick={() => { deleteSelected(); toast.success(`Deleted ${selectedCount} node(s)`); }} tip={`Delete ${selectedCount} selected`} className="hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" />
            </ToolbarBtn>
          )}
          <Divider />
          <div className="relative">
            <ToolbarBtn 
              onClick={() => { setShowLayoutMenu(!showLayoutMenu); setShowExportMenu(false); setShowBookmarks(false); }} 
              tip="Layout Options (A)" 
              className={cn(showLayoutMenu && "text-primary bg-primary/5")}
            >
              <LayoutDashboard className="h-4 w-4" />
            </ToolbarBtn>
            <AnimatePresence>
              {showLayoutMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col gap-1 rounded-2xl glass-morphism-strong pro-shadow p-2 z-dropdown min-w-[200px]"
                >
                  <div className="px-3 py-2 text-[9px] font-black uppercase tracking-[2px] text-primary/40 mb-1 border-b border-white/5">Auto Layouts</div>
                  {selectedCount > 1 && (
                    <button onClick={() => { tidyUp(); setShowLayoutMenu(false); toast.success('Tidied up selection'); }} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-primary transition-all hover:bg-primary/10 group animate-pulse">
                      <div className="p-1.5 rounded-lg bg-primary/20 group-hover:bg-primary/30"><Sparkles className="h-3.5 w-3.5 text-primary" /></div> Tidy Selected
                    </button>
                  )}
                  <button onClick={handleGridLayout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><LayoutGrid className="h-3.5 w-3.5 text-primary" /></div> Grid Layout
                  </button>
                  <button onClick={handleTreeLayout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><Network className="h-3.5 w-3.5 text-primary" /></div> Tree Layout
                  </button>
                  <button onClick={handleCircularLayout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><Orbit className="h-3.5 w-3.5 text-primary" /></div> Circular Layout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Divider />
          <ToolbarBtn onClick={() => openSearch()} tip="Search nodes (⌘K)" className="hover:bg-primary/10" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') e.preventDefault(); }}>
            <Search className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setShowTemplates(true)} tip="Template Gallery (T)" className="text-primary hover:bg-primary/10">
            <Sparkles className="h-4 w-4" />
          </ToolbarBtn>
          <div className="relative">
            <ToolbarBtn 
              onClick={() => { setShowExportMenu(!showExportMenu); setShowLayoutMenu(false); setShowBookmarks(false); }} 
              tip="Export" 
              className={cn(showExportMenu && "text-primary bg-primary/5")}
            >
              <FileDown className="h-4 w-4" />
            </ToolbarBtn>
            <AnimatePresence>
              {showExportMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col gap-1 rounded-2xl glass-morphism-strong pro-shadow p-2 z-dropdown min-w-[200px]"
                >
                  <div className="px-3 py-2 text-[9px] font-black uppercase tracking-[2px] text-primary/40 mb-1 border-b border-white/5">Export / Import</div>
                  <button onClick={() => handleExportMd(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><FileDown className="h-3.5 w-3.5 text-primary" /></div> Markdown
                  </button>
                  <button onClick={() => handleExportMd(true)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><FileText className="h-3.5 w-3.5 text-primary" /></div> MD (Full Fidelity)
                  </button>
                  <button onClick={() => handleExportZip(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><GitBranch className="h-3.5 w-3.5 text-primary" /></div> Export ZIP
                  </button>
                  {selectedCount > 0 && (
                    <button onClick={() => handleExportZip(true)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-primary transition-all hover:bg-primary/10 group animate-pulse">
                      <div className="p-1.5 rounded-lg bg-primary/20"><FileDown className="h-3.5 w-3.5 text-primary" /></div> Export Selection
                    </button>
                  )}
                  <button onClick={handleExportTxt} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><FileText className="h-3.5 w-3.5 text-primary" /></div> Plain Text
                  </button>
                  <button onClick={handleExportJson} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><FileJson className="h-3.5 w-3.5 text-primary" /></div> Export JSON
                  </button>
                  <div className="h-px bg-white/5 my-1" />
                  <button onClick={handleImportMarkdown} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><Upload className="h-3.5 w-3.5 text-primary" /></div> Import MD
                  </button>
                  <button onClick={handleImportZip} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><Upload className="h-3.5 w-3.5 text-primary" /></div> Import ZIP
                  </button>
                  <button onClick={handleImportJson} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><Upload className="h-3.5 w-3.5 text-primary" /></div> Import JSON
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <ToolbarBtn onClick={() => window.dispatchEvent(new CustomEvent('start-presentation'))} tip="Presentation mode (P)" className="hover:bg-primary/10">
            <Presentation className="h-4 w-4" />
          </ToolbarBtn>
          <Divider />
          <div className="relative">
            <ToolbarBtn 
              onClick={() => { setShowBookmarks(!showBookmarks); setShowLayoutMenu(false); setShowExportMenu(false); }} 
              tip="Viewport Bookmarks (B)" 
              className={cn(showBookmarks ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-primary/10')}
            >
              <BookmarkPlus className="h-4 w-4" />
            </ToolbarBtn>
            <AnimatePresence>
              {showBookmarks && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 min-w-[260px] rounded-2xl glass-morphism-strong pro-shadow p-4 z-dropdown"
                >
                  <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-4">
                    <span className="text-[10px] font-black uppercase tracking-[2px] text-primary/40">Viewports</span>
                    <button 
                      onClick={() => {
                        const name = prompt('Bookmark name:');
                        if (name) addBookmark(name, getViewport());
                      }}
                      className="rounded-lg bg-primary/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary/30 active:scale-95"
                    >
                      + Save View
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1 scrollbar-none">
                    {bookmarks.length === 0 ? (
                      <div className="py-8 text-center text-[10px] font-bold text-muted-foreground/20 uppercase tracking-[0.2em] italic">No views saved</div>
                    ) : (
                      bookmarks.map((b) => (
                        <div key={b.id} className="group flex items-center justify-between gap-2 rounded-xl p-3 transition-all cursor-pointer hover:bg-white/5 border border-transparent hover:border-white/10" onClick={() => { setViewport(b.viewport, { duration: 800 }); setShowBookmarks(false); }}>
                          <span className="text-[11px] font-black uppercase tracking-wider text-foreground/80 truncate">{b.name}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeBookmark(b.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground/40 transition-all"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Divider />
          <ToolbarBtn onClick={toggleMinimap} tip={`Minimap: ${showMinimap ? 'ON' : 'OFF'} (M)`} className={cn(showMinimap ? 'text-primary bg-primary/5 border border-primary/20' : 'hover:bg-primary/10')}>
            <MapIcon className="h-4 w-4" />
          </ToolbarBtn>
          <Divider />
          <TipBtn 
            tip={`Hybrid Editor (Mantine + BlockNote): ${enableHybridEditor ? 'ON' : 'OFF'}`} 
            onClick={() => setHybridEditorEnabled(!enableHybridEditor)}
            className={cn(
              "pro-btn rounded-xl px-2.5 py-2 transition-all glass-effect",
              enableHybridEditor ? "text-yellow-400 border-yellow-400/20 bg-yellow-400/5" : "text-muted-foreground/40"
            )}
          >
            {enableHybridEditor ? (
              <Zap className="h-4 w-4 fill-yellow-400/20 animate-pulse" />
            ) : (
              <ZapOff className="h-4 w-4" />
            )}
          </TipBtn>
          <Divider />
          <div className="px-1.5"><ThemeToggle /></div>
        </div>

        <TemplateGallery open={showTemplates} onClose={() => setShowTemplates(false)} />
      </Panel>

    </TooltipProvider>
  );
}

function Divider() {
  return <div className="h-6 w-px bg-white/5 mx-1.5 flex-shrink-0" />;
}

function ToolbarBtn({ children, onClick, disabled, tip, className, onKeyDown }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tip: string; className?: string; onKeyDown?: (e: React.KeyboardEvent) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className={cn(
            "flex-shrink-0 flex items-center justify-center p-2.5 rounded-xl text-muted-foreground/60 transition-all duration-200 hover:text-primary disabled:opacity-20",
            className
          )}
        >
          {children}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="top" className="premium-tooltip" sideOffset={12}>
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

const TipBtn = React.forwardRef<HTMLButtonElement, { children: React.ReactNode; onClick: () => void; tip: string; className?: string }>(
  ({ children, onClick, tip, className }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button ref={ref} onClick={onClick} className={className}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="premium-tooltip" sideOffset={8}>
        {tip}
      </TooltipContent>
    </Tooltip>
  )
);
TipBtn.displayName = 'TipBtn';
