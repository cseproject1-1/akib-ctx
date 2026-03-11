import { useReactFlow, Panel, useStore, useNodes, useEdges } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, Undo2, Redo2, ArrowLeft, Save, CheckCircle, AlertCircle, FileDown, Paintbrush, Share2, Eye, MousePointerClick, Presentation, Crosshair, LayoutDashboard, Grid3X3, Lock, Unlock, Trash2, Magnet, Cable, FileText, FileJson, Clock, GitBranch, CloudOff, Sparkles, Upload, Network, Orbit, LayoutGrid, Search, Map as MapIcon, BookmarkPlus, X, History, Pen, Maximize2, Minimize2, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getTreeLayout, getCircularLayout } from '@/lib/canvas/layoutUtils';
import { ThemeToggle } from './ThemeToggle';
import { useCanvasStore } from '@/store/canvasStore';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useNavigate } from 'react-router-dom';
import { exportToMarkdown, exportToPlainText, exportToJSON } from '@/lib/exportCanvas';
import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
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
import { PresenceList } from './PresenceList';
import { ShortcutsDialog } from './ShortcutsDialog';

interface CanvasToolbarProps {
  drawingMode?: boolean;
  onToggleDrawing?: () => void;
}

export function CanvasToolbar({ drawingMode, onToggleDrawing }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
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
  const setNodes = useCanvasStore((s) => s.setNodes);
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
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
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
  const setAISynthesisOpen = useCanvasStore((s) => s.setAISynthesisOpen);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

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
  const zoomPercent = Math.round(zoom * 100);

  const selectedCount = nodes.filter((n) => n.selected).length;

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  const handleExportMd = () => { exportToMarkdown(nodes, workspaceName); toast.success('Exported to Markdown'); setShowExportMenu(false); };
  const handleExportTxt = () => { exportToPlainText(nodes, workspaceName); toast.success('Exported to Plain Text'); setShowExportMenu(false); };
  const handleExportJson = () => { exportToJSON(nodes, workspaceName); toast.success('Exported to JSON'); setShowExportMenu(false); };

  const handleGridLayout = () => {
    if (nodes.length === 0) return;
    pushSnapshot();
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const gapX = 440;
    const gapY = 560;
    const newNodes = nodes.map((n, i) => ({
      ...n,
      position: {
        x: (i % cols) * gapX,
        y: Math.floor(i / cols) * gapY,
      },
    }));
    setNodes(newNodes);
    setTimeout(() => fitView({ duration: 400 }), 50);
    toast.success('Grid layout applied');
    setShowLayoutMenu(false);
  };

  const handleTreeLayout = () => {
    if (nodes.length === 0) return;
    pushSnapshot();
    const newNodes = getTreeLayout(nodes, edges);
    setNodes(newNodes);
    setTimeout(() => fitView({ duration: 400 }), 50);
    toast.success('Tree layout applied');
    setShowLayoutMenu(false);
  };

  const handleCircularLayout = () => {
    if (nodes.length === 0) return;
    pushSnapshot();
    const newNodes = getCircularLayout(nodes);
    setNodes(newNodes);
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
          
          if (Array.isArray(data)) {
            // It might be just nodes
            loadCanvas(data, []);
            toast.success('Nodes imported successfully!');
          } else if (data && typeof data === 'object') {
            const importNodes = Array.isArray(data.nodes) ? data.nodes : [];
            const importEdges = Array.isArray(data.edges) ? data.edges : [];
            
            // Re-map IDs to prevent collisions if pasting into same workspace
            const idMap = new Map<string, string>();
            const newNodes = importNodes.map(n => {
              const newId = crypto.randomUUID();
              idMap.set(n.id, newId);
              return { ...n, id: newId };
            });
            const newEdges = importEdges.map(e => ({
              ...e,
              id: crypto.randomUUID(),
              source: idMap.get(e.source) || e.source,
              target: idMap.get(e.target) || e.target,
            }));
            
            loadCanvas([...nodes, ...newNodes], [...edges, ...newEdges]);
            toast.success(`Imported ${newNodes.length} nodes and ${newEdges.length} edges.`);
          } else {
            toast.error('Invalid JSON structure. Needs nodes/edges arrays.');
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

  const gridLabel = {
    dots: 'Dots',
    lines: 'Lines',
    cross: 'Cross',
    graph: 'Graph',
    blank: 'Blank'
  }[gridStyle];

  return (
    <TooltipProvider delayDuration={300}>
      {/* Top-left: back + breadcrumb + workspace switcher + save */}
      <Panel position="top-left" className="!max-w-[calc(100vw-60px)]">
        <div className="flex flex-wrap items-center gap-2 animate-slide-down">
          <TipBtn tip="Back to Dashboard" onClick={() => { setShowExportMenu(false); navigate('/'); }} className="pro-btn rounded-xl glass-effect p-2.5 text-foreground/60 transition-all hover:text-primary hover:border-primary/20 hover:bg-primary/5">
            <ArrowLeft className="h-4 w-4" />
          </TipBtn>
          <div className="h-4 w-px bg-white/5 mx-0.5" />
          <WorkspaceSwitcher
            currentId={workspaceId || ''}
            currentName={workspaceName}
            currentColor={workspaceColor}
          />
          <div className={cn(
            "flex items-center gap-2 rounded-xl border border-white/5 glass-effect px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all",
            saveStatus === 'saved' ? 'text-primary' : saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground/40'
          )} title={lastSavedAt ? `Last saved ${lastSavedLabel}` : undefined}>
            {saveStatus === 'saving' && <><Save className="h-3.5 w-3.5 animate-pulse text-primary" />{!isMobile && <span className="pt-0.5">Saving…</span>}</>}
            {saveStatus === 'saved' && <><CheckCircle className="h-3.5 w-3.5 text-primary animate-scale-in" />{!isMobile && <span className="animate-fade-in pt-0.5">{lastSavedLabel || 'Saved'}</span>}</>}
            {saveStatus === 'error' && <><AlertCircle className="h-3.5 w-3.5 text-destructive animate-bounce-in" />{!isMobile && <span className="pt-0.5">Error</span>}</>}
            {saveStatus === 'idle' && <><Save className="h-3.5 w-3.5" /></>}
          </div>
          {pendingCount > 0 && (
            <TipBtn
              tip={`${pendingCount} unsynced change${pendingCount > 1 ? 's' : ''} — click to retry`}
              onClick={() => { replayPendingOps(); toast.info('Retrying sync…'); }}
              className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-destructive transition-all hover:bg-destructive/15 active:scale-95 animate-pulse"
            >
              <CloudOff className="h-3.5 w-3.5" />
              <span>{pendingCount}</span>
            </TipBtn>
          )}
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
          <PresenceList />
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

      {/* Bottom-center: zoom + undo/redo + tools */}
      <Panel position="bottom-center" className="mb-6 !max-w-[calc(100vw-24px)]">
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
          <ToolbarBtn onClick={() => zoomOut()} tip="Zoom out (⌘−)">
            <ZoomOut className="h-4 w-4" />
          </ToolbarBtn>
          <span className="w-12 text-center text-[10px] font-black text-primary/80 tabular-nums flex-shrink-0 tracking-widest">{zoomPercent}%</span>
          <ToolbarBtn onClick={() => zoomIn()} tip="Zoom in (⌘+)">
            <ZoomIn className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => fitView({ duration: 300 })} tip="Fit view (⌘⇧H)">
            <Maximize className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={toggleFullscreen} tip={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen (F11)'} className={cn(isFullscreen && "text-primary bg-primary/5")}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={() => onToggleDrawing?.()} tip="Drawing mode (D)" className={cn(drawingMode ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-primary/10')}>
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
          <Divider />
          <ToolbarBtn onClick={toggleSnap} tip={`Snap to grid: ${snapEnabled ? 'ON' : 'OFF'} (S)`} className={cn(snapEnabled ? 'text-primary bg-primary/5 border border-primary/20' : 'hover:bg-primary/10')}>
            <Magnet className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={cycleGridStyle} tip={`Grid style: ${gridLabel} (G)`} className="gap-2 px-3">
            <Grid3X3 className="h-4 w-4" />
            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">{gridLabel}</span>
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
            <ToolbarBtn onClick={() => { setShowLayoutMenu(!showLayoutMenu); setShowExportMenu(false); setShowBookmarks(false); }} tip="Layout Options (A)" className={cn(showLayoutMenu && "text-primary bg-primary/5")}>
              <LayoutDashboard className="h-4 w-4" />
            </ToolbarBtn>
            <AnimatePresence>
              {showLayoutMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col gap-1 rounded-2xl glass-morphism-strong pro-shadow p-2 z-[100] min-w-[200px]"
                >
                  <div className="px-3 py-2 text-[9px] font-black uppercase tracking-[2px] text-primary/40 mb-1 border-b border-white/5">Auto Layouts</div>
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
          <ToolbarBtn onClick={() => openSearch()} tip="Search nodes (⌘K)" className="hover:bg-primary/10">
            <Search className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setShowTemplates(true)} tip="Template Gallery (T)" className="text-primary hover:bg-primary/10">
            <Sparkles className="h-4 w-4" />
          </ToolbarBtn>
          <div className="relative">
            <ToolbarBtn onClick={() => { setShowExportMenu(!showExportMenu); setShowLayoutMenu(false); setShowBookmarks(false); }} tip="Export" className={cn(showExportMenu && "text-primary bg-primary/5")}>
              <FileDown className="h-4 w-4" />
            </ToolbarBtn>
            <AnimatePresence>
              {showExportMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col gap-1 rounded-2xl glass-morphism-strong pro-shadow p-2 z-[100] min-w-[200px]"
                >
                  <div className="px-3 py-2 text-[9px] font-black uppercase tracking-[2px] text-primary/40 mb-1 border-b border-white/5">Export / Import</div>
                  <button onClick={handleExportMd} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><FileDown className="h-3.5 w-3.5 text-primary" /></div> Markdown
                  </button>
                  <button onClick={handleExportTxt} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><FileText className="h-3.5 w-3.5 text-primary" /></div> Plain Text
                  </button>
                  <button onClick={handleExportJson} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-primary/20"><FileJson className="h-3.5 w-3.5 text-primary" /></div> Export JSON
                  </button>
                  <div className="h-px bg-white/5 my-1" />
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
            <ToolbarBtn onClick={() => { setShowBookmarks(!showBookmarks); setShowLayoutMenu(false); setShowExportMenu(false); }} tip="Viewport Bookmarks (B)" className={cn(showBookmarks ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-primary/10')}>
              <BookmarkPlus className="h-4 w-4" />
            </ToolbarBtn>
            <AnimatePresence>
              {showBookmarks && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 min-w-[260px] rounded-2xl glass-morphism-strong pro-shadow p-4 z-[1000]"
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

function ToolbarBtn({ children, onClick, disabled, tip, className }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tip: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
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
