import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  useViewport,
  type ReactFlowInstance,
  type Edge,
  type Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  Plus,
  LayoutGrid,
  Bookmark,
  History,
  Pin,
  Link2,
  X,
  Undo,
  Redo,
  Minimize2,
  Maximize2,
  BookOpen,
  MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NodeExpandModal } from '@/components/canvas/NodeExpandModal';
import { useCanvasStore, useNodes, useEdges } from '@/store/canvasStore';
import { nodeTypes } from '@/components/canvas/nodeTypes';
import { edgeTypes } from '@/components/canvas/edgeTypes';
import { useMobileSync } from '@/mobile/hooks/useMobileSync';
import { MobileLayout } from '@/mobile/layout/MobileLayout';
import { MobileVersionHistory } from '@/mobile/components/MobileVersionHistory';
import { MobileBookmarks } from '@/mobile/components/MobileBookmarks';
import { MobilePinnedNodes } from '@/mobile/components/MobilePinnedNodes';
import { MobileNodeContextMenu } from '@/mobile/components/MobileNodeContextMenu';
import { GestureOverlay } from '@/mobile/components/GestureOverlay';
import { MobileBatchOperations } from '@/mobile/components/MobileBatchOperations';
import { MobileViewMode } from '@/mobile/components/MobileViewMode';
import { useToastManager, useBasicToast } from '@/mobile/hooks/useToastManager';

// Custom hook for haptic feedback
const useHaptic = () => {
  const trigger = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = { light: 10, medium: 20, heavy: 30 };
      navigator.vibrate(patterns[type]);
    }
  }, []);
  return trigger;
};

// Content component that uses ReactFlow hooks (must be inside ReactFlowProvider)
function MobileCanvasContent() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const nodes = useNodes();
  const edges = useEdges();
  const { loadWorkspaceData } = useMobileSync();
  const triggerHaptic = useHaptic();
  const toast = useToastManager();
  const basicToast = useBasicToast();
  
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<any, any> | null>(null);
  
  // Modal states
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showPinnedNodes, setShowPinnedNodes] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showNodeList, setShowNodeList] = useState(false);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [isConnectionMode, setIsConnectionMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  
  const nodeContextMenu = useCanvasStore((s) => s.nodeContextMenu);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const addNode = useCanvasStore((s) => s.addNode);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const fitViewCalled = useRef(false);
  
  // These hooks MUST be used inside ReactFlowProvider
  const { zoomIn, zoomOut, fitView, setNodes } = useReactFlow();
  const { zoom } = useViewport();
  
  // Get undo/redo from store
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  
  // Selection state for multi-select
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBatchOperations, setShowBatchOperations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Long press timer
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const hasLoadedWorkspace = useRef(false);

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };
  }, []);

  // Load workspace data on mount - only once per workspace
  useEffect(() => {
    if (workspaceId && !hasLoadedWorkspace.current) {
      setIsLoading(true);
      loadWorkspaceData(workspaceId)
        .then(() => {
          setIsLoading(false);
          hasLoadedWorkspace.current = true;
          // Automatically fit view once data is loaded
          if (!fitViewCalled.current) {
            setTimeout(() => {
              fitView({ duration: 800, padding: 0.2 });
              fitViewCalled.current = true;
            }, 500);
          }
        })
        .catch((error) => {
          console.error('Failed to load workspace:', error);
          setIsLoading(false);
          hasLoadedWorkspace.current = true;
          setLoadError(error?.message || 'Failed to load workspace data');
        });
    } else {
      setIsLoading(false);
    }
  }, [workspaceId, loadWorkspaceData, fitView]);

  // Zoom controls with haptic feedback
  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
    triggerHaptic('light');
  }, [zoomIn, triggerHaptic]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
    triggerHaptic('light');
  }, [zoomOut, triggerHaptic]);

  const handleFitView = useCallback(() => {
    fitView({ duration: 300, padding: 0.1 });
    triggerHaptic('light');
  }, [fitView, triggerHaptic]);

  // Enhanced gesture handler
  const handleGesture = useCallback((gesture: any) => {
    switch (gesture.type) {
      case 'swipe':
        if (gesture.direction === 'left' && gesture.velocity > 0.5) {
          // Swipe left - could trigger next action
          triggerHaptic('light');
        } else if (gesture.direction === 'right' && gesture.velocity > 0.5) {
          // Swipe right - could trigger previous action
          triggerHaptic('light');
        }
        break;
      case 'threeFingerSwipe':
        if (gesture.direction === 'left') {
          // Three finger left - undo
          undo();
          basicToast.info('Undo');
        } else if (gesture.direction === 'right') {
          // Three finger right - redo
          redo();
          basicToast.info('Redo');
        }
        break;
      case 'pinch':
        // Pinch gesture is handled by ReactFlow
        break;
      case 'doubleTap':
        // Double tap to fit view
        handleFitView();
        break;
    }
  }, [triggerHaptic, undo, redo, handleFitView, basicToast]);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    const newMode = !selectionMode;
    setSelectionMode(newMode);
    if (!newMode) {
      setSelectedNodes([]);
    }
    triggerHaptic('medium');
  }, [selectionMode, triggerHaptic]);

  // Handle node selection in selection mode
  const handleNodeSelection = useCallback((nodeId: string) => {
    setSelectedNodes(prev => {
      if (prev.includes(nodeId)) {
        return prev.filter(id => id !== nodeId);
      } else {
        return [...prev, nodeId];
      }
    });
    triggerHaptic('light');
  }, [triggerHaptic]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedNodes([]);
    setSelectionMode(false);
  }, []);

  const handleAddNode = useCallback(() => {
    setIsAddingNode(true);
    setIsConnectionMode(false);
    // Silent mode - no popup for this action
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleToggleConnectionMode = useCallback(() => {
    const nextMode = !isConnectionMode;
    setIsConnectionMode(nextMode);
    setIsAddingNode(false);
    setConnectSourceId(null);
    // Silent mode - mode change is indicated by visual feedback
    triggerHaptic('medium');
  }, [isConnectionMode, triggerHaptic]);

  const handlePaneClick = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    setNodeContextMenu(null);
    
    if (isAddingNode && reactFlowInstance) {
      // Get position from reactFlowInstance
      const clientX = 'clientX' in event ? event.clientX : (event as React.TouchEvent).touches?.[0]?.clientX ?? 0;
      const clientY = 'clientY' in event ? event.clientY : (event as React.TouchEvent).touches?.[0]?.clientY ?? 0;
      const position = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });

      const newNode: any = {
        id: crypto.randomUUID(),
        type: 'aiNote',
        position,
        data: { title: 'New Note', content: '' },
        style: { width: 300, height: 200, zIndex: 1000 },
      };

      addNode(newNode);
      setIsAddingNode(false);
      triggerHaptic('medium');
    }
  }, [isAddingNode, reactFlowInstance, addNode, triggerHaptic, setNodeContextMenu]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    triggerHaptic('light');

    // Selection mode - toggle node selection
    if (selectionMode) {
      handleNodeSelection(node.id);
      return;
    }

    if (isConnectionMode) {
      if (!connectSourceId) {
        setConnectSourceId(node.id);
        // Silent mode - visual indication shows source selected
        triggerHaptic('medium');
      } else if (connectSourceId !== node.id) {
        onConnect({ 
          source: connectSourceId, 
          target: node.id,
          sourceHandle: 's-r', // Defaults
          targetHandle: 't-l'
        });
        setConnectSourceId(null);
        // Silent mode - nodes visual connection shows success
        triggerHaptic('heavy');
      }
      return;
    }

    // Open node editor on click
    setExpandedNode(node.id);
    triggerHaptic('medium');
  }, [selectionMode, handleNodeSelection, isConnectionMode, connectSourceId, onConnect, setExpandedNode, triggerHaptic]);

  return (
    <GestureOverlay onGesture={handleGesture}>
      <div 
        className="h-full w-full bg-canvas-bg overflow-hidden relative"
        data-mobile-canvas
      >
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-background/50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading workspace...</span>
          </div>
        </div>
      )}
      {/* Error Overlay */}
      {loadError && !isLoading && (
        <div className="absolute inset-0 z-50 bg-background/80 flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-lg font-bold">Failed to Load</h3>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/mobile-mode')}>
                Go Back
              </Button>
              <Button onClick={() => {
                setLoadError(null);
                hasLoadedWorkspace.current = false;
                if (workspaceId) {
                  setIsLoading(true);
                  loadWorkspaceData(workspaceId)
                    .then(() => { setIsLoading(false); hasLoadedWorkspace.current = true; })
                    .catch((e) => { setIsLoading(false); hasLoadedWorkspace.current = true; setLoadError(e?.message || 'Retry failed'); });
                }
              }}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.2}
          maxZoom={4}
          panOnDrag={!isConnectionMode}
          panOnScroll={false}
          zoomOnScroll={true}
          zoomOnPinch={true}
          nodeDragThreshold={12}
          selectionOnDrag={false}
          connectOnClick={false}
          defaultEdgeOptions={{ type: 'custom', animated: false }}
          onInit={(instance) => setReactFlowInstance(instance)}
          onNodeDoubleClick={(_, node) => {
            setExpandedNode(node.id);
            triggerHaptic('medium');
          }}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="var(--border)"
          />
        </ReactFlow>
      </div>

      {/* Sticky/Pinned Nodes Indicator */}
      <div className="absolute top-20 left-4 flex flex-col gap-1 z-10">
        {nodes.filter(n => (n.data as any)?.pinned).map(node => (
          <motion.div
            key={node.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 bg-primary/20 backdrop-blur px-2 py-1 rounded-full text-xs text-primary cursor-pointer"
            onClick={() => {
              setExpandedNode(node.id);
              triggerHaptic('light');
            }}
            title={(node.data as any)?.title || 'Pinned Node'}
          >
            <Pin className="h-3 w-3" />
            <span className="truncate max-w-[120px]">
              {(node.data as any)?.title || 'Node'}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Top Toolbar - compact 4-button layout */}
      <div className="absolute top-4 left-4 right-4 flex justify-between z-10 gap-2">
        <div className="flex gap-2">
          {/* Undo */}
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full shadow-md"
              onClick={() => { undo(); triggerHaptic('light'); }}
              aria-label="Undo"
            >
              <Undo className="h-5 w-5" />
            </Button>
          </motion.div>
          {/* Redo */}
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full shadow-md"
              onClick={() => { redo(); triggerHaptic('light'); }}
              aria-label="Redo"
            >
              <Redo className="h-5 w-5" />
            </Button>
          </motion.div>
          {/* Overflow Menu */}
          <div className="relative">
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full shadow-md transition-all",
                  showOverflow ? "bg-primary text-primary-foreground" : ""
                )}
                onClick={() => { setShowOverflow(!showOverflow); triggerHaptic('light'); }}
                aria-label="More actions"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </motion.div>
            {/* Overflow dropdown */}
            <AnimatePresence>
              {showOverflow && (
                <>
                  {/* Backdrop to close */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-12 left-0 z-50 bg-card border border-border rounded-2xl shadow-xl p-1.5 min-w-[200px]"
                  >
                    <button
                      onClick={() => { setShowVersionHistory(true); setShowOverflow(false); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm hover:bg-accent active:scale-[0.98] transition-all"
                    >
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Version History</span>
                    </button>
                    <button
                      onClick={() => { setShowBookmarks(true); setShowOverflow(false); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm hover:bg-accent active:scale-[0.98] transition-all"
                    >
                      <Bookmark className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Bookmarks</span>
                    </button>
                    <button
                      onClick={() => { setShowPinnedNodes(true); setShowOverflow(false); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm hover:bg-accent active:scale-[0.98] transition-all"
                    >
                      <Pin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Pinned Nodes</span>
                    </button>
                    <div className="h-px bg-border my-1" />
                    <button
                      onClick={() => { toggleSelectionMode(); setShowOverflow(false); }}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm hover:bg-accent active:scale-[0.98] transition-all",
                        selectionMode && "bg-primary/10 text-primary"
                      )}
                    >
                      <Minimize2 className="h-4 w-4" />
                      <span className="font-medium">{selectionMode ? 'Exit Selection' : 'Select Nodes'}</span>
                    </button>
                    <button
                      onClick={() => { setShowNodeList(true); setShowOverflow(false); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm hover:bg-accent active:scale-[0.98] transition-all"
                    >
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Node List</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Connection Mode Toggle */}
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant={isConnectionMode ? "default" : "secondary"}
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full shadow-md transition-all",
              isConnectionMode ? "bg-primary text-primary-foreground scale-110" : ""
            )}
            onClick={handleToggleConnectionMode}
            aria-label="Connection Mode"
          >
            <Link2 className={cn("h-5 w-5", isConnectionMode ? "animate-pulse" : "")} />
          </Button>
        </motion.div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-20 left-4 flex flex-col gap-2 z-10">
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full shadow-md"
            onClick={handleZoomIn}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full shadow-md"
            onClick={handleZoomOut}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full shadow-md"
            onClick={handleFitView}
            aria-label="Fit view"
          >
            <LayoutGrid className="h-5 w-5" />
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full shadow-md"
            onClick={() => { setViewMode(true); triggerHaptic('medium'); }}
            aria-label="View mode"
          >
            <BookOpen className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>

      {/* Add Node FAB */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
      >
        <Button
          className={cn(
            "absolute bottom-20 right-4 h-14 w-14 rounded-full shadow-lg shadow-primary/30",
            isAddingNode ? "bg-destructive hover:bg-destructive/90" : "bg-primary"
          )}
          onClick={isAddingNode ? () => setIsAddingNode(false) : handleAddNode}
          aria-label="Add node"
        >
          {isAddingNode ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </motion.div>

      {/* Zoom Level Indicator */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur px-3 py-1 rounded-full text-xs text-muted-foreground">
        {Math.round(zoom * 100)}%
      </div>

      {/* Selection Mode Indicator */}
      {selectionMode && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute bottom-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium shadow-lg"
        >
          {selectedNodes.length} selected
        </motion.div>
      )}

      {/* Modal Overlays */}
      <NodeExpandModal />
      <MobileVersionHistory 
        isOpen={showVersionHistory} 
        onClose={() => setShowVersionHistory(false)} 
      />
      <MobileBookmarks 
        isOpen={showBookmarks} 
        onClose={() => setShowBookmarks(false)} 
      />
      <MobilePinnedNodes 
        isOpen={showPinnedNodes} 
        onClose={() => setShowPinnedNodes(false)} 
      />
      {nodeContextMenu && (
        <MobileNodeContextMenu 
          isOpen={!!nodeContextMenu}
          nodeId={nodeContextMenu.nodeId}
          position={{ x: nodeContextMenu.x, y: nodeContextMenu.y }}
          onClose={() => setNodeContextMenu(null)}
        />
      )}

      {/* Batch Operations Panel */}
      <MobileBatchOperations
        isOpen={showBatchOperations && selectedNodes.length > 0}
        selectedNodeIds={selectedNodes}
        onClose={() => setShowBatchOperations(false)}
        onClearSelection={clearSelection}
      />

      {/* View Mode */}
      {viewMode && (
        <MobileViewMode
          nodes={nodes}
          onClose={() => setViewMode(false)}
          initialNodeId={useCanvasStore.getState().expandedNode || nodes[0]?.id}
        />
      )}

      {/* Selection Mode Toggle Button */}
      {selectedNodes.length > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute bottom-4 right-4 z-10"
        >
          <Button
            size="sm"
            onClick={() => setShowBatchOperations(true)}
            className="h-10 px-4 rounded-full shadow-lg"
          >
            <span className="font-medium">{selectedNodes.length} selected</span>
          </Button>
        </motion.div>
      )}

      {/* Node List Quick-Switcher */}
      <AnimatePresence>
        {showNodeList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[180] bg-background/95 backdrop-blur-md flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border safe-area-top">
              <h2 className="text-lg font-bold">All Nodes</h2>
              <button
                onClick={() => setShowNodeList(false)}
                className="p-2 rounded-full hover:bg-accent active:scale-95 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {nodes.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No nodes yet</p>
              ) : (
                [...nodes]
                  .sort((a, b) => {
                    if (Math.abs(a.position.y - b.position.y) > 20) return a.position.y - b.position.y;
                    return a.position.x - b.position.x;
                  })
                  .map((node, idx) => {
                    const nd = node.data as any;
                    const title = nd.title || nd.year || nd.label || nd.text || 'Untitled';
                    const type = (node.type || 'note').replace(/([A-Z])/g, ' $1').trim();
                    return (
                      <button
                        key={node.id}
                        onClick={() => {
                          if (reactFlowInstance) {
                            const nodePos = node.position;
                            const nodeWidth = (node.measured?.width || node.width || 300) as number;
                            const nodeHeight = (node.measured?.height || node.height || 200) as number;
                            reactFlowInstance.setCenter(
                              nodePos.x + nodeWidth / 2,
                              nodePos.y + nodeHeight / 2,
                              { zoom: 1.2, duration: 600 }
                            );
                          }
                          setShowNodeList(false);
                          triggerHaptic('light');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card hover:border-primary/50 active:scale-[0.99] transition-all text-left"
                      >
                        <span className="text-[10px] font-black text-muted-foreground tabular-nums w-5 text-right">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{title}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{type}</p>
                        </div>
                      </button>
                    );
                  })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </GestureOverlay>
  );
}

// Main MobileCanvas component with ReactFlowProvider
export function MobileCanvas() {
  const navigate = useNavigate();
  const workspaceName = useCanvasStore((s) => s.workspaceName);

  const goBack = useCallback(() => {
    navigate('/mobile-mode');
  }, [navigate]);

  return (
    <MobileLayout 
      title={workspaceName || 'Canvas'}
      onBack={goBack}
      showBottomNav={false}
    >
      <ReactFlowProvider>
        <MobileCanvasContent />
      </ReactFlowProvider>
    </MobileLayout>
  );
}
