import { useReactFlow, Panel, useStore } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, Undo2, Redo2, ArrowLeft, Save, CheckCircle, AlertCircle, FileDown, Paintbrush, Share2, Eye, MousePointerClick, Presentation, Crosshair, LayoutDashboard, Grid3X3, Lock, Unlock, Trash2, Magnet, Cable, FileText, FileJson, Clock, GitBranch, CloudOff, Sparkles, Upload, Network, Orbit, LayoutGrid, Search } from 'lucide-react';
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
import { TemplateGallery } from './TemplateGallery';
import { useNodes, useEdges } from '@xyflow/react'; // Ensure these are imported if missing

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

  const gridLabel = gridStyle === 'dots' ? 'Dots' : gridStyle === 'lines' ? 'Lines' : 'Cross';

  return (
    <TooltipProvider delayDuration={300}>
      {/* Top-left: back + breadcrumb + workspace switcher + save */}
      <Panel position="top-left" className="!max-w-[calc(100vw-60px)]">
        <div className="flex flex-wrap items-center gap-1.5 animate-slide-down">
          <TipBtn tip="Back to Dashboard" onClick={() => { setShowExportMenu(false); navigate('/'); }} className="brutal-btn rounded-lg bg-card p-2 text-foreground flex-shrink-0 transition-transform hover:scale-105 active:scale-95">
            <ArrowLeft className="h-4 w-4" />
          </TipBtn>
          <span className="text-muted-foreground font-bold mx-1 opacity-50">/</span>
          <WorkspaceSwitcher
            currentId={workspaceId || ''}
            currentName={workspaceName}
            currentColor={workspaceColor}
          />
          <div className={`flex items-center gap-1 rounded-lg border-2 border-border bg-card px-2 py-1.5 text-xs font-bold uppercase tracking-wider flex-shrink-0 transition-all ${saveStatus === 'saved' ? 'border-green/50' : saveStatus === 'error' ? 'border-destructive/50' : ''}`} title={lastSavedAt ? `Last saved ${lastSavedLabel}` : undefined}>
            {saveStatus === 'saving' && <><Save className="h-3 w-3 animate-pulse text-primary" />{!isMobile && <span>Saving…</span>}</>}
            {saveStatus === 'saved' && <><CheckCircle className="h-3 w-3 text-green animate-scale-in" />{!isMobile && <span className="animate-fade-in">{lastSavedLabel || 'Saved'}</span>}</>}
            {saveStatus === 'error' && <><AlertCircle className="h-3 w-3 text-destructive animate-bounce-in" />{!isMobile && <span>Error</span>}</>}
            {saveStatus === 'idle' && <><Save className="h-3 w-3 text-muted-foreground" /></>}
          </div>
          {pendingCount > 0 && (
            <TipBtn
              tip={`${pendingCount} unsynced change${pendingCount > 1 ? 's' : ''} — click to retry`}
              onClick={() => { replayPendingOps(); toast.info('Retrying sync…'); }}
              className="brutal-btn flex items-center gap-1 rounded-lg bg-destructive/10 border-2 border-destructive/30 px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-destructive flex-shrink-0 transition-transform hover:scale-105 active:scale-95 animate-pulse"
            >
              <CloudOff className="h-3.5 w-3.5" />
              <span>{pendingCount}</span>
            </TipBtn>
          )}
          <TipBtn tip="Share workspace" onClick={() => setShareOpen(true)} className="brutal-btn flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground flex-shrink-0 transition-transform hover:scale-105 active:scale-95">
            <Share2 className="h-3.5 w-3.5" />
            {!isMobile && <span>Share</span>}
          </TipBtn>
          <TipBtn tip="Version history" onClick={() => setVersionHistoryOpen(!versionHistoryOpen)} className={`brutal-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider flex-shrink-0 transition-transform hover:scale-105 active:scale-95 ${versionHistoryOpen ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>
            <Clock className="h-3.5 w-3.5" />
          </TipBtn>
          <TipBtn tip="Branch workspace" onClick={() => setBranchOpen(true)} className="brutal-btn flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-foreground flex-shrink-0 transition-transform hover:scale-105 active:scale-95">
            <GitBranch className="h-3.5 w-3.5" />
          </TipBtn>
        </div>
      </Panel>

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
      <Panel position="bottom-center" className="mb-4 !max-w-[calc(100vw-24px)]">
        <div id="canvas-toolbar" className="flex items-center gap-0 rounded-xl border-2 border-border bg-card shadow-[var(--brutal-shadow)] overflow-x-auto overflow-y-hidden scrollbar-none animate-toolbar-appear">
          <ToolbarBtn onClick={() => undo()} disabled={past.length === 0} tip="Undo (⌘Z)">
            <Undo2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => redo()} disabled={future.length === 0} tip="Redo (⌘⇧Z)">
            <Redo2 className="h-4 w-4" />
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={() => zoomOut()} tip="Zoom out (⌘−)">
            <ZoomOut className="h-4 w-4" />
          </ToolbarBtn>
          <span className="w-10 text-center text-[10px] font-bold text-muted-foreground tabular-nums flex-shrink-0">{zoomPercent}%</span>
          <ToolbarBtn onClick={() => zoomIn()} tip="Zoom in (⌘+)">
            <ZoomIn className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => fitView({ duration: 300 })} tip="Fit view (⌘⇧H)">
            <Maximize className="h-4 w-4" />
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={() => onToggleDrawing?.()} tip="Drawing mode (D)" className={drawingMode ? 'bg-primary text-primary-foreground' : ''} animated>
            <Paintbrush className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn id="connector-mode-btn" onClick={() => { const newMode = !connectMode; setConnectMode(newMode); if (newMode) toast.info('Connector mode: click the source node'); }} tip="Connector mode (C)" className={connectMode ? 'bg-primary text-primary-foreground' : ''} animated>
            <Cable className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={toggleCanvasMode} tip={canvasMode === 'edit' ? 'Switch to view mode (V)' : 'Switch to edit mode (V)'} className={canvasMode === 'view' ? 'bg-primary text-primary-foreground' : ''} animated>
            {canvasMode === 'view' ? <Eye className="h-4 w-4" /> : <MousePointerClick className="h-4 w-4" />}
          </ToolbarBtn>
          <ToolbarBtn onClick={toggleFocusMode} tip="Focus mode (F)" className={focusMode ? 'bg-primary text-primary-foreground' : ''} animated>
            <Crosshair className="h-4 w-4" />
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={toggleSnap} tip={`Snap to grid: ${snapEnabled ? 'ON' : 'OFF'} (S)`} className={snapEnabled ? 'bg-accent text-primary' : ''} animated>
            <Magnet className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={cycleGridStyle} tip={`Grid style: ${gridLabel} (G)`} animated>
            <Grid3X3 className="h-4 w-4" />
            <span className="ml-0.5 text-[9px] font-bold uppercase hidden sm:inline">{gridLabel}</span>
          </ToolbarBtn>
          <ToolbarBtn onClick={toggleLockAll} tip={allLocked ? 'Unlock all nodes (L)' : 'Lock all nodes (L)'} className={allLocked ? 'bg-accent text-primary' : ''} animated>
            {allLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </ToolbarBtn>
          {selectedCount > 0 && (
            <ToolbarBtn onClick={() => { deleteSelected(); toast.success(`Deleted ${selectedCount} node(s)`); }} tip={`Delete ${selectedCount} selected`}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </ToolbarBtn>
          )}
          <Divider />
          <div className="relative">
            <ToolbarBtn onClick={() => setShowLayoutMenu(!showLayoutMenu)} tip="Layout Options (A)" animated>
              <LayoutDashboard className="h-4 w-4" />
            </ToolbarBtn>
            {showLayoutMenu && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col gap-0.5 rounded-lg border-2 border-border bg-card p-1 shadow-[var(--brutal-shadow)] animate-scale-in z-50 min-w-[150px]">
                <button onClick={handleGridLayout} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground">
                  <LayoutGrid className="h-3.5 w-3.5" /> Grid Layout
                </button>
                <button onClick={handleTreeLayout} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Network className="h-3.5 w-3.5" /> Tree Layout
                </button>
                <button onClick={handleCircularLayout} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Orbit className="h-3.5 w-3.5" /> Circular Layout
                </button>
              </div>
            )}
          </div>
          <Divider />
          <ToolbarBtn id="search-btn" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true }))} tip="Search nodes (⌘K)" animated>
            <Search className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setShowTemplates(true)} tip="Template Gallery (T)" animated className="text-primary hover:bg-primary/10">
            <Sparkles className="h-4 w-4" />
          </ToolbarBtn>
          <div className="relative">
            <ToolbarBtn onClick={() => setShowExportMenu(!showExportMenu)} tip="Export" animated>
              <FileDown className="h-4 w-4" />
            </ToolbarBtn>
            {showExportMenu && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col gap-0.5 rounded-lg border-2 border-border bg-card p-1 shadow-[var(--brutal-shadow)] animate-scale-in z-50 min-w-[140px]">
                <button onClick={handleExportMd} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground">
                  <FileDown className="h-3.5 w-3.5" /> Markdown
                </button>
                <button onClick={handleExportTxt} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground">
                  <FileText className="h-3.5 w-3.5" /> Plain Text
                </button>
                <button onClick={handleExportJson} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground">
                  <FileJson className="h-3.5 w-3.5" /> Export JSON
                </button>
                <button onClick={handleImportJson} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground border-t border-border/50 mt-1 pt-2">
                  <Upload className="h-3.5 w-3.5" /> Import JSON
                </button>
              </div>
            )}
          </div>
          <ToolbarBtn onClick={() => window.dispatchEvent(new Event('start-presentation'))} tip="Presentation mode (P)" animated>
            <Presentation className="h-4 w-4" />
          </ToolbarBtn>
          <Divider />
          <ThemeToggle />
        </div>

        <TemplateGallery open={showTemplates} onClose={() => setShowTemplates(false)} />
      </Panel>

    </TooltipProvider>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-border flex-shrink-0" />;
}

function ToolbarBtn({ children, onClick, disabled, tip, className, animated }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tip: string; className?: string; animated?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`flex-shrink-0 flex items-center p-2.5 text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-primary active:scale-90 disabled:opacity-20 disabled:hover:bg-transparent ${animated ? 'hover:[&>svg]:rotate-12 hover:[&>svg]:scale-110 [&>svg]:transition-transform [&>svg]:duration-200' : ''} ${className || ''}`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs font-bold">
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
      <TooltipContent side="bottom" className="text-xs font-bold">
        {tip}
      </TooltipContent>
    </Tooltip>
  )
);
TipBtn.displayName = 'TipBtn';
