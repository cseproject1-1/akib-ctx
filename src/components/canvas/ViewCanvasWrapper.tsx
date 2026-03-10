import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore } from '@/store/canvasStore';
import { nodeTypes } from './nodeTypes';
import { edgeTypes } from './edgeTypes';
import { Eye, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ViewCanvasWrapper() {
  const navigate = useNavigate();
  const { nodes, edges, workspaceName } = useCanvasStore();

  // Make all nodes non-interactive
  const viewNodes = nodes.map((n) => ({
    ...n,
    draggable: false,
    connectable: false,
    selectable: false,
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
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'custom', animated: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="hsl(0 0% 12%)"
          gap={24}
          size={1.5}
        />

        <Panel position="top-left" className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="brutal-btn rounded-lg bg-card p-2 text-foreground"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 rounded-lg border-2 border-border bg-card px-3 py-1.5">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">{workspaceName}</span>
            <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              View Only
            </span>
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
      </ReactFlow>
    </div>
  );
}
