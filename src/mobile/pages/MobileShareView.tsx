import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Eye } from 'lucide-react';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import type { Node } from '@xyflow/react';
import { MobileViewMode } from '@/mobile/components/MobileViewMode';

export default function MobileShareView() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');

  useEffect(() => {
    if (!workspaceId) return;

    const originalTitle = document.title;

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
        setWorkspaceName(wsData.name || 'Shared Workspace');

        // Update meta for SEO
        document.title = `${wsData.name} | CtxNote`;

        const nodesSnap = await getDocs(collection(wsRef, 'nodes'));

        const loadedNodes: Node[] = nodesSnap.docs.map(docSnap => {
          const row = docSnap.data();
          return {
            id: docSnap.id,
            type: row.type,
            position: { x: row.position_x, y: row.position_y },
            data: row.data || {},
            style: { width: row.width, height: row.height, zIndex: row.z_index },
          };
        });

        setNodes(loadedNodes);
      } catch (err) {
        console.error('Failed to load shared workspace:', err);
        setError('Failed to load shared workspace.');
      } finally {
        setLoading(false);
      }
    };
    load();

    return () => {
      document.title = originalTitle;
    };
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading shared workspace...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Not Available</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
        <a
          href="/mobile-mode"
          className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
        >
          Go Home
        </a>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Shared workspace badge */}
      <div className="flex-shrink-0 bg-muted/50 border-b border-border/50 px-4 py-1.5 flex items-center gap-2 safe-area-top">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
          {workspaceName} · Shared View
        </span>
      </div>

      {/* Full-screen reader */}
      <div className="flex-1 min-h-0">
        <MobileViewMode
          nodes={nodes}
          onClose={() => { window.location.href = '/mobile-mode'; }}
          initialNodeId={nodes[0]?.id}
        />
      </div>
    </div>
  );
}
