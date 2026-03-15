import { ReactFlowProvider } from '@xyflow/react';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { Loader2, AlertCircle } from 'lucide-react';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import type { Node, Edge } from '@xyflow/react';
import { ViewCanvasWrapper } from '@/components/canvas/ViewCanvasWrapper';

const ViewWorkspacePage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const setWorkspaceId = useCanvasStore((s) => s.setWorkspaceId);
  const setWorkspaceMeta = useCanvasStore((s) => s.setWorkspaceMeta);

  useEffect(() => {
    if (!workspaceId) return;
    setWorkspaceId(workspaceId);

    const load = async () => {
      try {
        const wsRef = doc(db, 'workspaces', workspaceId);
        const wsSnap = await getDoc(wsRef);

        if (!wsSnap.exists()) {
          setError('This workspace is not publicly shared or does not exist.');
          setLoading(false);
          return;
        }

        const wsData = wsSnap.data();
        setWorkspaceMeta(wsData.name, wsData.color);

        // Update meta data for SEO & Social Sharing
        document.title = `${wsData.name} | CtxNote`;
        
        const updateMeta = (name: string, content: string, attr: string = 'name') => {
          let el = document.querySelector(`meta[${attr}="${name}"]`);
          if (el) {
            el.setAttribute('content', content);
          } else {
            el = document.createElement('meta');
            el.setAttribute(attr, name);
            el.setAttribute('content', content);
            document.head.appendChild(el);
          }
        };

        const description = `Shared workspace: ${wsData.name} on CtxNote. Interactive canvas for AI-assisted note taking.`;
        updateMeta('description', description);
        updateMeta('og:title', `${wsData.name} | CtxNote`, 'property');
        updateMeta('og:description', description, 'property');
        updateMeta('og:type', 'website', 'property');
        updateMeta('twitter:card', 'summary_large_image');
        updateMeta('twitter:title', `${wsData.name} | CtxNote`);
        updateMeta('twitter:description', description);

        const nodesSnap = await getDocs(collection(wsRef, 'nodes'));
        const edgesSnap = await getDocs(collection(wsRef, 'edges'));

        const nodes: Node[] = nodesSnap.docs.map(docSnap => {
          const row = docSnap.data();
          return {
            id: docSnap.id,
            type: row.type,
            position: { x: row.position_x, y: row.position_y },
            data: row.data || {},
            style: { width: row.width, height: row.height, zIndex: row.z_index },
          };
        });

        const edges: Edge[] = edgesSnap.docs.map(docSnap => {
          const row = docSnap.data();
          return {
            id: docSnap.id,
            source: row.source_node_id,
            target: row.target_node_id,
            sourceHandle: row.source_handle || undefined,
            targetHandle: row.target_handle || undefined,
            type: 'custom',
            label: row.label || undefined,
            data: row.style || {},
          };
        });

        loadCanvas(nodes, edges);
      } catch {
        setError('Failed to load shared workspace.');
      } finally {
        setLoading(false);
      }
    };
    load();

    return () => {
      document.title = 'CtxNote';
    };
  }, [workspaceId, loadCanvas, setWorkspaceId, setWorkspaceMeta]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-bold text-foreground">{error}</p>
        <a href="/" className="text-sm text-primary underline">Go to Dashboard</a>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ViewCanvasWrapper />
    </ReactFlowProvider>
  );
};

export default ViewWorkspacePage;
