import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FileUp, FileText, Globe, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseMarkdownToNodes, parseNotionHtmlToNodes } from '@/lib/import/importService';
import { createWorkspace, getWorkspaces, Workspace } from '@/lib/firebase/workspaces';
import { saveNode, saveEdge } from '@/lib/firebase/canvasData';
import { importFromZip, importFromMarkdown } from '@/lib/exportCanvas';
import { useCanvasStore } from '@/store/canvasStore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function ImportModal({ open, onOpenChange, initialFiles }: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  initialFiles?: FileList | null
}) {
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const handleFiles = useCallback(async (files: FileList) => {
    setIsImporting(true);
    try {
      // Get existing workspaces to handle name collisions
      const existingWorkspaces = await getWorkspaces();
      const existingNames = new Set(existingWorkspaces.map(ws => ws.name.toLowerCase()));

      const getUniqueName = (baseName: string) => {
        let name = baseName;
        let counter = 1;
        while (existingNames.has(name.toLowerCase())) {
          name = `${baseName} (${counter})`;
          counter++;
        }
        existingNames.add(name.toLowerCase()); // Add to set for subsequent files in same batch
        return name;
      };

      for (const file of Array.from(files)) {
        let nodes = [];
        let edges = [];
        const isHtml = file.type === 'text/html' || file.name.endsWith('.html');
        const isMd = file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.type === 'text/markdown';
        const isZip = file.name.endsWith('.zip') || file.type === 'application/zip';

        if (isZip) {
          const zipData = await importFromZip(file);
          nodes = zipData.nodes;
          edges = zipData.edges;
        } else if (isHtml || isMd) {
          const text = await file.text();
          if (isHtml) {
            nodes = parseNotionHtmlToNodes(text);
          } else {
            nodes = parseMarkdownToNodes(text);
          }
        } else {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }

        if (nodes.length === 0) {
          toast.error(`No content found in ${file.name}`);
          continue;
        }

        // Create a new workspace for this import
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const workspaceName = getUniqueName(baseName);
        const ws = await createWorkspace(workspaceName, '#3b82f6');
        const wsId = ws.id;
        
        // Re-map IDs to prevent collisions and maintain connections
        const idMap = new Map<string, string>();
        const remappedNodes = nodes.map(n => {
          const newId = crypto.randomUUID();
          idMap.set(n.id, newId);
          return { 
            ...n, 
            id: newId,
            data: { ...n.data, workspaceId: wsId }
          };
        });

        const remappedEdges = edges.map(e => ({
          ...e,
          id: crypto.randomUUID(),
          source: idMap.get(e.source) || e.source,
          target: idMap.get(e.target) || e.target,
        }));

        // ALWAYS save to Firebase to ensure dashboard count and persistence are correct
        const nodePromises = remappedNodes.map(n => saveNode(wsId, n as any));
        const edgePromises = remappedEdges.map(e => saveEdge(wsId, e as any));
        await Promise.all([...nodePromises, ...edgePromises]);

        // Use loadCanvas to batch everything if we are navigating there
        if (files.length === 1) {
          useCanvasStore.getState().loadCanvas(remappedNodes, remappedEdges);
          navigate(`/workspace/${wsId}`);
        }

        toast.success(`Imported ${file.name} as "${workspaceName}"`);
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
    }
  }, [navigate, onOpenChange]);

  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      handleFiles(initialFiles);
    }
  }, [open, initialFiles, handleFiles]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <FileUp className="h-5 w-5 text-primary" />
            Import Knowledge
          </DialogTitle>
          <DialogDescription className="font-bold text-foreground/70">
            Import your Obsidian vaults (.md), Notion exports (.html), or CtxNote ZIP backups.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-10 transition-all duration-300 ${dragActive ? 'border-primary bg-primary/10 scale-[0.98]' : 'border-border/60 bg-card/50'}`}
        >
          {isImporting ? (
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-semibold tracking-wide animate-pulse text-muted-foreground">Processing Files...</p>
            </div>
          ) : (
            <>
              <div className="flex gap-6 mb-2">
                <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-3"><FileText className="h-6 w-6 text-primary" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Obsidian</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-3"><Globe className="h-6 w-6 text-primary" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notion</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-3"><FileUp className="h-6 w-6 text-primary" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ZIP</span>
                </div>
              </div>
              <p className="text-center text-sm font-medium text-muted-foreground mb-2">
                Drag and drop files here or click below
              </p>
              <label className="cursor-pointer rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95 shadow-sm">
                Select Files
                <input
                  type="file"
                  multiple
                  accept=".md,.markdown,.html,.zip"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </label>
            </>
          )}
        </div>

        <div className="space-y-3 rounded-xl bg-accent/30 p-4 border border-border/50">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                What's preserved?
            </h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
                <li>• Heading hierarchy</li>
                <li>• Content sections</li>
                <li>• Links & Lists</li>
                <li>• Basic Formatting</li>
            </ul>
        </div>

        <DialogFooter className="border-t border-border/50 pt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border/50 bg-card px-6 py-2 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-accent/50 active:scale-95"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
