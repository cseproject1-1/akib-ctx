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
  X
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
import { toast } from 'sonner';

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
  
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null);
  
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
  
  // Long press timer
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  // Load workspace data on mount
  useEffect(() => {
    if (workspaceId) {
      loadWorkspaceData(workspaceId).then(() => {
        // Automatically fit view once data is loaded
        if (!fitViewCalled.current && nodes.length > 0) {
          setTimeout(() => {
            fitView({ duration: 800, padding: 0.2 });
            fitViewCalled.current = true;
          }, 500);
        }
      });
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

  const handleAddNode = useCallback(() => {
    setIsAddingNode(true);
    setIsConnectionMode(false);
    toast.info('Tap on canvas to add node');
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleToggleConnectionMode = useCallback(() => {
    const nextMode = !isConnectionMode;
    setIsConnectionMode(nextMode);
    setIsAddingNode(false);
    setConnectSourceId(null);
    if (nextMode) {
      toast.info('Connection Mode: Tap source then target');
    } else {
      toast.info('Connection Mode disabled');
    }
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
      toast.success('Node added');
    }
  }, [isAddingNode, reactFlowInstance, addNode, triggerHaptic, setNodeContextMenu]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    triggerHaptic('light');

    if (isConnectionMode) {
      if (!connectSourceId) {
        setConnectSourceId(node.id);
        toast.info('Source selected. Now tap target node.');
        triggerHaptic('medium');
      } else if (connectSourceId !== node.id) {
        onConnect({ 
          source: connectSourceId, 
          target: node.id,
          sourceHandle: 's-r', // Defaults
          targetHandle: 't-l'
        });
        setConnectSourceId(null);
        toast.success('Nodes connected');
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
  }, [isConnectionMode, connectSourceId, onConnect, setExpandedNode, setNodes, triggerHaptic]);

  return (
    <div 
      className="h-full w-full bg-canvas-bg overflow-hidden"
      data-mobile-canvas
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
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
    </div>
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
