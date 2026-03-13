import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore, useNodes, useEdges } from '@/store/canvasStore';
import { nodeTypes } from './nodeTypes';
import { edgeTypes } from './edgeTypes';
import { Eye, ArrowLeft, ZoomIn, ZoomOut, Maximize, Layout, List, LayoutGrid, Home, Smartphone, Share2, X, Pencil } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NodeExpandModal } from './NodeExpandModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileListView } from './MobileListView';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function ViewCanvasWrapper() {
  const navigate = useNavigate();
  const nodes = useNodes();
  const edges = useEdges();
  const workspaceName = useCanvasStore((s) => s.workspaceName);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const toggleCanvasMode = useCanvasStore((s) => s.toggleCanvasMode);
  const isBlockEditorMode = useCanvasStore((s) => s.isBlockEditorMode);
  const toggleBlockEditorMode = useCanvasStore((s) => s.toggleBlockEditorMode);
  const mobileMode = useCanvasStore((s) => s.mobileMode);
  const toggleMobileMode = useCanvasStore((s) => s.toggleMobileMode);
  const isMobile = useIsMobile();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: workspaceName,
        text: `Check out this workspace: ${workspaceName}`,
        url: window.location.href
      }).catch(() => {});
    }
  };

  // When in 'edit' mode in the share view, allow draggability but changes aren't saved to server
  const viewNodes = nodes.map((n) => ({
    ...n,
    draggable: canvasMode === 'edit',
    connectable: canvasMode === 'edit',
    selectable: true,
  }));

  return (
    <div className="h-screen w-screen bg-canvas-bg">
      <ReactFlow
        nodes={viewNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={4}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        panOnScroll={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'custom', animated: false }}
        onNodeDoubleClick={(_, node) => {
          useCanvasStore.getState().setExpandedNode(node.id);
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="hsl(0 0% 12%)"
          gap={24}
          size={1.5}
        />

        {!isMobile && (
          <Panel position="bottom-right" className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-lg">
            <button onClick={() => zoomIn()} className="p-2 hover:bg-accent rounded transition-colors" title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button onClick={() => zoomOut()} className="p-2 hover:bg-accent rounded transition-colors" title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button onClick={() => fitView()} className="p-2 hover:bg-accent rounded transition-colors" title="Fit View">
              <Maximize className="h-4 w-4" />
            </button>
          </Panel>
        )}

        <Panel position="top-left" className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {!isMobile && (
              <button
                onClick={() => navigate('/')}
                className="brutal-btn rounded-lg bg-card p-2 text-foreground"
                title="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-1 rounded-lg border-2 border-border bg-card p-1 shadow-sm">
              <button
                onClick={() => canvasMode !== 'view' && toggleCanvasMode()}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1 text-xs font-bold transition-all",
                  canvasMode === 'view' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
                )}
              >
                <Eye className="h-3 w-3" />
                View
              </button>
              <button
                onClick={() => canvasMode !== 'edit' && toggleCanvasMode()}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1 text-xs font-bold transition-all",
                  canvasMode === 'edit' ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:bg-accent"
                )}
              >
                <Pencil className="h-3 w-3" />
                Editor Mode
              </button>
            </div>
            
            <div className="flex items-center gap-2 rounded-lg border-2 border-border bg-card px-3 py-1.5 shadow-sm">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground max-sm:max-w-[120px] truncate">{workspaceName}</span>
            </div>
          </div>
        </Panel>

        <Panel position="bottom-center" className="mb-6">
          <div className="flex flex-col items-center gap-3">
            {canvasMode === 'edit' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold uppercase tracking-widest rounded-full backdrop-blur-md shadow-lg"
              >
                Local Edit Mode: Changes won't be saved
              </motion.div>
            )}
          </div>
        </Panel>


        <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 12 12"
              refX="11"
              refY="6"
              markerWidth={10}
              markerHeight={10}
              orient="auto-start-reverse"
            >
              <path d="M 1 1 L 11 6 L 1 11 L 4 6 Z" fill="hsl(0, 0%, 35%)" />
            </marker>
          </defs>
        </svg>
        <NodeExpandModal />
      </ReactFlow>

      <AnimatePresence>
        {mobileMode && <MobileListView />}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-6 py-3 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-2xl animate-brutal-pop">
          <MobileNavBtn 
            active={!mobileMode} 
            onClick={() => mobileMode && toggleMobileMode()} 
            icon={<LayoutGrid className="h-5 w-5" />} 
            label="Canvas" 
          />
          <MobileNavBtn 
            active={mobileMode} 
            onClick={() => !mobileMode && toggleMobileMode()} 
            icon={<List className="h-5 w-5" />} 
            label="List" 
          />
          <div className="w-[1px] h-8 bg-border/50 mx-1" />
          <MobileNavBtn 
            active={canvasMode === 'edit'} 
            onClick={() => toggleCanvasMode()} 
            icon={<Pencil className="h-5 w-5" />} 
            label="Edit" 
          />
          <MobileNavBtn 
            active={false} 
            onClick={() => fitView()} 
            icon={<Maximize className="h-5 w-5" />} 
            label="Fit" 
          />
          <div className="w-[1px] h-8 bg-border/50 mx-1" />
          <MobileNavBtn 
            active={false} 
            onClick={() => navigate('/')} 
            icon={<Home className="h-5 w-5" />} 
            label="Home" 
          />
        </div>
      )}
    </div>
  );
}

function MobileNavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all active:scale-[0.85]",
        active 
          ? "text-primary bg-primary/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] scale-105" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <div className={cn("transition-transform duration-300", active && "scale-110")}>
        {icon}
      </div>
      <span className={cn(
        "text-[9px] font-black uppercase tracking-widest transition-all",
        active ? "opacity-100" : "opacity-60"
      )}>
        {label}
      </span>
    </button>
  );
}
