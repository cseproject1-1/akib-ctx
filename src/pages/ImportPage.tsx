import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { getWorkspaces, createWorkspace, Workspace } from '@/lib/firebase/workspaces';
import { saveNode } from '@/lib/cache/canvasCache';

export default function ImportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!user || isImporting) return;

    const type = searchParams.get('type');
    const title = searchParams.get('title') || 'Clipped Note';
    const content = searchParams.get('content') || '';
    const url = searchParams.get('url') || '';

    if (type === 'clip') {
      const handleImport = async () => {
        setIsImporting(true);
        try {
          const workspaces = await getWorkspaces();
          let clippingWorkspace = workspaces.find(w => w.name === 'Clippings' && !w.is_deleted);
          
          if (!clippingWorkspace) {
            toast.info('Creating Clippings workspace...');
            clippingWorkspace = await createWorkspace('Clippings', '#3b82f6');
          }

          const newNode = {
            id: uuidv4(),
            type: 'aiNote',
            position: { x: 100, y: 100 },
            data: {
              title,
              content: {
                type: 'doc',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: title }] },
                  { type: 'paragraph', content: [{ type: 'text', text: content }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'Source: ' }, { type: 'text', marks: [{ type: 'link', attrs: { href: url } }], text: url }] }
                ]
              },
              tags: ['clipped'],
              createdAt: new Date().toISOString()
            }
          };

          await saveNode(clippingWorkspace.id, newNode as any);
          toast.success('Saved to Clippings!');
          navigate(`/workspace/${clippingWorkspace.id}`);
        } catch (err) {
          console.error(err);
          toast.error('Failed to import clip');
          navigate('/');
        }
      };

      handleImport();
    } else {
      navigate('/');
    }
  }, [user, searchParams, navigate, isImporting]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Importing your clip...</p>
      </div>
    </div>
  );
}
