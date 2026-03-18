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
  Maximize2
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
  
  // Long press timer
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  // Load workspace data on mount
  useEffect(() => {
    if (workspaceId) {
      setIsLoading(true);
      loadWorkspaceData(workspaceId)
        .then(() => {
          setIsLoading(false);
          // Automatically fit view once data is loaded
          if (!fitViewCalled.current && nodes.length > 0) {
            setTimeout(() => {
              fitView({ duration: 800, padding: 0.2 });
              fitViewCalled.current = true;
            }, 500);
          }
        })
        .catch((error) => {
          console.error('Failed to load workspace:', error);
          setIsLoading(false);
          // Silent failure - let user continue working
        });
    } else {
      setIsLoading(false);
    }
  }, [workspaceId, loadWorkspaceData, fitView, nodes.length]);

  // Touch gesture handling for canvas
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    
    // Set up long press for context menu
    longPressTimer.current = setTimeout(() => {
      // Show context menu at touch position
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const nodeElement = element?.closest('[data-node-id]');
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-node-id');
        if (nodeId) {
          useCanvasStore.getState().setNodeContextMenu({
            x: touch.clientX,
            y: touch.clientY,
            nodeId
          });
          triggerHaptic('light');
        }
      }
    }, 500);
  }, [triggerHaptic]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartRef.current.y);
      
      // Cancel long press if moved significantly
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

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
      const position = reactFlowInstance.screenToFlowPosition({
        x: 'clientX' in event ? event.clientX : (event as React.TouchEvent).touches[0].clientX,
        y: 'clientY' in event ? event.clientY : (event as React.TouchEvent).touches[0].clientY,
      });

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
      // Silent mode - visual feedback shows node was added
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

    // Tap-to-Edit: If already selected, open expand modal
    if (node.selected) {
      setExpandedNode(node.id);
      triggerHaptic('medium');
    } else {
      // Logic handled by ReactFlow for selection, but we can enhance it
      setNodes((nds) => 
        nds.map((n) => ({
          ...n,
          selected: n.id === node.id
        }))
      );
    }
  }, [selectionMode, handleNodeSelection, isConnectionMode, connectSourceId, onConnect, setExpandedNode, setNodes, triggerHaptic]);

  return (
    <GestureOverlay onGesture={handleGesture}>
      <div 
        className="h-full w-full bg-canvas-bg overflow-hidden relative"
        data-mobile-canvas
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-background/80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading workspace...</span>
          </div>
        </div>
      )}
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
        nodeDragThreshold={8}
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

      {/* Top Toolbar */}
      <div className="absolute top-4 left-4 right-4 flex justify-between z-10">
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full shadow-md"
              onClick={() => setShowVersionHistory(true)}
              aria-label="Version history"
            >
              <History className="h-5 w-5" />
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full shadow-md"
              onClick={() => setShowBookmarks(true)}
              aria-label="Bookmarks"
            >
              <Bookmark className="h-5 w-5" />
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full shadow-md"
              onClick={() => setShowPinnedNodes(true)}
              aria-label="Pinned nodes"
            >
              <Pin className="h-5 w-5" />
            </Button>
          </motion.div>
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
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant={selectionMode ? "default" : "secondary"}
              size="icon"
              className={cn(
                "h-10 w-10 rounded-full shadow-md transition-all",
                selectionMode ? "bg-primary text-primary-foreground scale-110" : ""
              )}
              onClick={toggleSelectionMode}
              aria-label="Selection mode"
            >
              <Minimize2 className="h-5 w-5" />
            </Button>
          </motion.div>
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
            "absolute bottom-4 right-4 h-14 w-14 rounded-full shadow-lg shadow-primary/30",
            isAddingNode ? "bg-destructive hover:bg-destructive/90" : "bg-primary"
          )}
          onClick={isAddingNode ? () => setIsAddingNode(false) : handleAddNode}
          aria-label="Add node"
        >
          {isAddingNode ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </motion.div>

      {/* Zoom Level Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur px-3 py-1 rounded-full text-xs text-muted-foreground">
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
