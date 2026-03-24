import { useNavigate } from 'react-router-dom';
import { Plus, Brain, Trash2, LogOut, Loader2, Layers, Star, Search, SortAsc, LayoutGrid, List, Copy, BookOpen, Beaker, Briefcase, Code, Palette, Music, Lightbulb, GraduationCap, Rocket, Info, Calendar, Clock, FileText, Folder, FolderPlus, MoreVertical, MoreHorizontal, Edit2, ChevronRight, ChevronDown, RotateCcw, Trash, Check, X, Settings, FileUp, Shield, Lock, Unlock, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { Node } from '@xyflow/react';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { createWorkspace, deleteWorkspace, duplicateWorkspace, updateWorkspace, restoreWorkspace, permanentlyDeleteWorkspace, emptyTrash, type Workspace } from '@/lib/firebase/workspaces';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { cachedGetWorkspaces, cachedGetNodeCount, invalidateWorkspaceList, invalidateWorkspaceCache, saveNode } from '@/lib/cache/canvasCache';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { canvasTemplates, instantiateTemplate } from '@/lib/canvasTemplates';
import { HotkeySettingsModal } from '@/components/dashboard/HotkeySettingsModal';
import { ImportModal } from '@/components/dashboard/ImportModal';
import { PasswordManageDialog } from '@/components/PasswordManageDialog';
import { VaultModal } from '@/components/VaultModal';
import { useVaultStore } from '@/store/vaultStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCanvasStore } from '@/store/canvasStore';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, FileDown } from 'lucide-react';
import { loadCanvasNodes, loadCanvasEdges } from '@/lib/firebase/canvasData';
import { exportToZip } from '@/lib/exportCanvas';
import { BrandingBanner } from '@/components/dashboard/BrandingBanner';

const WORKSPACE_ICONS: { icon: LucideIcon; label: string; color: string }[] = [
  { icon: LayoutGrid, label: 'Grid', color: '#3b82f6' },
  { icon: BookOpen, label: 'Book', color: '#22c55e' },
  { icon: Beaker, label: 'Science', color: '#8b5cf6' },
  { icon: Briefcase, label: 'Work', color: '#f97316' },
  { icon: Code, label: 'Code', color: '#06b6d4' },
  { icon: Palette, label: 'Art', color: '#ec4899' },
  { icon: Music, label: 'Music', color: '#FACC15' },
  { icon: Lightbulb, label: 'Ideas', color: '#ef4444' },
  { icon: GraduationCap, label: 'Study', color: '#22c55e' },
  { icon: Rocket, label: 'Launch', color: '#8b5cf6' },
];

function getIconForColor(color: string): { icon: LucideIcon; color: string } {
  let hash = 0;
  for (let i = 0; i < color.length; i++) hash = ((hash << 5) - hash + color.charCodeAt(i)) | 0;
  const entry = WORKSPACE_ICONS[Math.abs(hash) % WORKSPACE_ICONS.length];
  return { icon: entry.icon, color: entry.color };
}

type SortMode = 'recent' | 'name' | 'nodes';
type ViewMode = 'grid' | 'list';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const isVaultLocked = useVaultStore((s) => s.isLocked);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingTagsWorkId, setEditingTagsWorkId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showStatsId, setShowStatsId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { canInstall, installApp } = usePWAInstall();
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('crxnote-favorites') || '[]')); }
    catch { return new Set(); }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
   const [importFiles, setImportFiles] = useState<FileList | null>(null);
  // Password protection state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [showPasswordManageDialog, setShowPasswordManageDialog] = useState(false);
  const [passwordManageWorkspaceId, setPasswordManageWorkspaceId] = useState<string | null>(null);
  // Vault state — single VaultModal handles all sub-flows
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [vaultModalMode, setVaultModalMode] = useState<'unlock' | 'set' | 'change_verify' | 'change_new' | 'remove' | 'settings' | undefined>(undefined);
  // Vault workspaces (separate list, loaded only when unlocked)
  const [vaultWorkspaces, setVaultWorkspaces] = useState<Workspace[]>([]);
  const [vaultNodeCounts, setVaultNodeCounts] = useState<Record<string, number>>({});

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setImportFiles(e.dataTransfer.files);
      setShowImport(true);
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('crxnote-favorites', JSON.stringify([...next]));
      return next;
    });
  };

  const allFolders = useMemo(() => {
    const folders = new Set<string>();
    workspaces.filter(ws => !ws.is_deleted).forEach(ws => { if (ws.folder) folders.add(ws.folder); });
    return Array.from(folders).sort();
  }, [workspaces]);

   const folderCounts = useMemo(() => {
     const counts: Record<string, number> = {
       all: workspaces.filter(ws => !ws.is_deleted).length,
       unorganized: workspaces.filter(ws => !ws.is_deleted && !ws.folder).length,
       trash: workspaces.filter(ws => ws.is_deleted).length
     };
     allFolders.forEach(folder => {
       counts[folder] = workspaces.filter(ws => !ws.is_deleted && ws.folder === folder).length;
     });
     // Add vault count if vault is unlocked
     if (selectedFolder === 'vault' && !isVaultLocked) {
       counts.vault = vaultWorkspaces.length;
     }
     return counts;
   }, [workspaces, allFolders, vaultWorkspaces.length, isVaultLocked, selectedFolder]);

   const sortedWorkspaces = useMemo(() => {
     // Special handling for vault folder
     if (selectedFolder === 'vault') {
       // Show vault workspaces (only if vault is unlocked)
       if (useVaultStore.getState().isLocked) {
         return []; // Return empty array if vault is locked
       }
       // Filter workspaces that are in the vault
       let filtered = workspaces.filter(ws => ws.is_in_vault && !ws.is_deleted);
       
       // Apply search and tag filters
       filtered = filtered.filter((ws) =>
         ws.name.toLowerCase().includes(searchQuery.toLowerCase())
       );

       if (selectedTag) {
         filtered = filtered.filter(ws => ws.tags?.includes(selectedTag));
       }

       return filtered.sort((a, b) => {
         const af = favorites.has(a.id) ? 1 : 0;
         const bf = favorites.has(b.id) ? 1 : 0;
         if (af !== bf) return bf - af;
         switch (sortMode) {
           case 'name': return a.name.localeCompare(b.name);
           case 'nodes': return (vaultNodeCounts[b.id] || 0) - (vaultNodeCounts[a.id] || 0);
           default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
         }
       });
     }

     // Determine the base filter based on whether we're in trash or not
     let filtered = workspaces.filter(ws => selectedFolder === 'trash' ? ws.is_deleted : !ws.is_deleted);

     // Apply folder filter
     if (selectedFolder !== 'trash') {
       if (selectedFolder) {
         filtered = filtered.filter(ws => ws.folder === selectedFolder);
       } else if (selectedFolder === '') {
         filtered = filtered.filter(ws => !ws.folder);
       }
     }

     // Apply search and tag filters
     filtered = filtered.filter((ws) =>
       ws.name.toLowerCase().includes(searchQuery.toLowerCase())
     );

     if (selectedTag) {
       filtered = filtered.filter(ws => ws.tags?.includes(selectedTag));
     }

     return filtered.sort((a, b) => {
       const af = favorites.has(a.id) ? 1 : 0;
       const bf = favorites.has(b.id) ? 1 : 0;
       if (af !== bf) return bf - af;
       switch (sortMode) {
         case 'name': return a.name.localeCompare(b.name);
         case 'nodes': return (nodeCounts[b.id] || 0) - (nodeCounts[a.id] || 0);
         default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
       }
     });
   }, [workspaces, searchQuery, sortMode, favorites, nodeCounts, vaultNodeCounts, selectedFolder, selectedTag, isVaultLocked]);

   const loadRegularWorkspaces = useCallback(async () => {
     try {
       const { cached, fresh } = await cachedGetWorkspaces(async (freshData) => {
         setWorkspaces(freshData);
         // Refresh node counts incrementally
         await Promise.all(freshData.map(async (ws) => {
           const count = await cachedGetNodeCount(ws.id);
           setNodeCounts((prev) => ({ ...prev, [ws.id]: count }));
         }));
       }, { excludeVault: true });

       // Instant render from cache
       if (cached) {
         setWorkspaces(cached);
         setLoading(false);
         // Load cached node counts incrementally
         await Promise.all(cached.map(async (ws) => {
           const count = await cachedGetNodeCount(ws.id);
           setNodeCounts((prev) => ({ ...prev, [ws.id]: count }));
         }));
       }

       // Wait for fresh if no cache
       if (!cached) {
         const data = await fresh;
         setWorkspaces(data);
         setLoading(false);
         // Load fresh node counts
         await Promise.all(data.map(async (ws) => {
           const count = await cachedGetNodeCount(ws.id);
           setNodeCounts((prev) => ({ ...prev, [ws.id]: count }));
         }));
       }
     } catch (error) {
       setLoading(false);
       toast.error('Failed to load workspaces');
       console.error('Workspace loading error:', error);
     }
   }, []);

   const loadVaultWorkspaces = useCallback(async () => {
     try {
       const { cached, fresh } = await cachedGetWorkspaces(async (freshData) => {
         // Filter for vault workspaces only
         const vaultWorkspaces = freshData.filter(ws => ws.is_in_vault);
         setVaultWorkspaces(vaultWorkspaces);
         // Refresh node counts for vault workspaces
         await Promise.all(vaultWorkspaces.map(async (ws) => {
           const count = await cachedGetNodeCount(ws.id);
           setVaultNodeCounts((prev) => ({ ...prev, [ws.id]: count }));
         }));
       }, { excludeVault: false });

       // Instant render from cache
       if (cached) {
         const vaultCached = cached.filter(ws => ws.is_in_vault);
         setVaultWorkspaces(vaultCached);
         setLoading(false);
         // Load cached node counts for vault workspaces
         await Promise.all(vaultCached.map(async (ws) => {
           const count = await cachedGetNodeCount(ws.id);
           setVaultNodeCounts((prev) => ({ ...prev, [ws.id]: count }));
         }));
       }

       // Wait for fresh if no cache
       if (!cached) {
         const data = await fresh;
         const vaultFresh = data.filter(ws => ws.is_in_vault);
         setVaultWorkspaces(vaultFresh);
         setLoading(false);
         // Load fresh node counts for vault workspaces
         await Promise.all(vaultFresh.map(async (ws) => {
           const count = await cachedGetNodeCount(ws.id);
           setVaultNodeCounts((prev) => ({ ...prev, [ws.id]: count }));
         }));
       }
     } catch (error) {
       setLoading(false);
       toast.error('Failed to load vault workspaces');
       console.error('Vault workspace loading error:', error);
     }
   }, []);

   useEffect(() => {
     if (!user) return;
     loadRegularWorkspaces();
     loadVaultWorkspaces();
   }, [user, loadRegularWorkspaces, loadVaultWorkspaces]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    // Validate password if protection is enabled
    if (isPasswordProtected) {
      if (!newPassword || newPassword.length < 4) {
        toast.error('Password must be at least 4 characters long');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }
    
    setCreating(true);
    try {
      // Import password hashing function
      const { hashPassword } = await import('@/lib/utils/password');
      const passwordHash = isPasswordProtected ? await hashPassword(newPassword) : undefined;
      
      const ws = await createWorkspace(newName.trim(), WORKSPACE_ICONS[newIcon].color, passwordHash);
      if (selectedTemplate) {
        const templateNodes = instantiateTemplate(selectedTemplate);
        if (templateNodes.length > 0) {
          // Immediately save template nodes to Firebase so they persist on refresh
          await Promise.all(templateNodes.map(node => saveNode(ws.id, node as Node)));
          const { loadCanvas } = useCanvasStore.getState();
          loadCanvas(templateNodes as Node[], []);
        }
      }
      navigate(`/workspace/${ws.id}${selectedTemplate ? `?template=${selectedTemplate}` : ''}`);
    } catch (err) {
      toast.error('Failed to create workspace');
    } finally {
      setCreating(false);
      // Reset password fields
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordProtected(false);
    }
  };

   const handleDuplicate = async (e: React.MouseEvent, ws: Workspace) => {
     e.stopPropagation();
     try {
       await duplicateWorkspace(ws.id, `${ws.name} (copy)`, ws.color);
       toast.success('Workspace duplicated');
       await loadRegularWorkspaces();
       await loadVaultWorkspaces();
     } catch (err) {
       toast.error('Failed to duplicate workspace');
     }
   };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    // Check if workspace is password protected
    const workspace = workspaces.find(w => w.id === id);
    if (workspace?.is_password_protected) {
      // For now, we'll use a simple prompt as a fallback
      // In a full implementation, we would use the PasswordDialog component
      const password = prompt('This workspace is password protected. Please enter the password to delete it:');
      if (!password) return; // User cancelled
      
      // Import password verification function
      const { verifyPassword } = await import('@/lib/utils/password');
      const isValid = await verifyPassword(password, workspace.password_hash || '');
      if (!isValid) {
        toast.error('Incorrect password');
        return;
      }
    }
    
    try {
      await deleteWorkspace(id);
      setWorkspaces((prev) => prev.map(w => w.id === id ? { ...w, is_deleted: true, deleted_at: new Date().toISOString() } : w));
      toast.success('Workspace moved to Trash', {
        action: {
          label: 'Undo',
          onClick: () => handleRestore(id)
        }
      });
    } catch (err) {
      toast.error('Failed to move workspace to trash');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreWorkspace(id);
      setWorkspaces((prev) => prev.map(w => w.id === id ? { ...w, is_deleted: false, deleted_at: null } : w));
      toast.success('Workspace restored');
    } catch (err) {
      toast.error('Failed to restore workspace');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    // Check if workspace is password protected
    const workspace = workspaces.find(w => w.id === id);
    if (workspace?.is_password_protected) {
      // For now, we'll use a simple prompt as a fallback
      // In a full implementation, we would use the PasswordDialog component
      const password = prompt('This workspace is password protected. Please enter the password to permanently delete it:');
      if (!password) return; // User cancelled
      
      // Import password verification function
      const { verifyPassword } = await import('@/lib/utils/password');
      const isValid = await verifyPassword(password, workspace.password_hash || '');
      if (!isValid) {
        toast.error('Incorrect password');
        return;
      }
    }
    
    if (!confirm('Permanently delete this workspace? This action CANNOT be undone.')) return;
    try {
      await permanentlyDeleteWorkspace(id);
      await Promise.all([invalidateWorkspaceList(), invalidateWorkspaceCache(id)]);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      toast.success('Workspace permanently deleted');
    } catch (err) {
      toast.error('Failed to delete workspace');
    }
  };

  const handleManagePassword = (id: string) => {
    setPasswordManageWorkspaceId(id);
    setShowPasswordManageDialog(true);
  };

  const handleSetPassword = async (password: string) => {
    if (!passwordManageWorkspaceId) return;
    
    const { hashPassword } = await import('@/lib/utils/password');
    const passwordHash = await hashPassword(password);
    await updateWorkspace(passwordManageWorkspaceId, { password_hash: passwordHash, is_password_protected: true });
    setWorkspaces(prev => prev.map(w => w.id === passwordManageWorkspaceId ? { ...w, password_hash: passwordHash, is_password_protected: true } : w));
  };

   const handleRemovePassword = async () => {
     if (!passwordManageWorkspaceId) return;
     
     await updateWorkspace(passwordManageWorkspaceId, { password_hash: undefined, is_password_protected: false });
     setWorkspaces(prev => prev.map(w => w.id === passwordManageWorkspaceId ? { ...w, password_hash: undefined, is_password_protected: false } : w));
   };

   const handleMoveToVault = async (workspaceId: string) => {
     try {
       await updateWorkspace(workspaceId, { is_in_vault: true });
       // Optimistically update workspaces state
       setWorkspaces(prev => prev.map(ws => ws.id === workspaceId ? { ...ws, is_in_vault: true } : ws));
       // Optimistically update vaultWorkspaces state
       setVaultWorkspaces(prev => {
         const ws = prev.find(w => w.id === workspaceId);
         if (ws) {
           return prev.map(w => w.id === workspaceId ? { ...w, is_in_vault: true } : w);
         } else {
           const workspaceToAdd = workspaces.find(w => w.id === workspaceId);
           if (workspaceToAdd) {
             return [...prev, { ...workspaceToAdd, is_in_vault: true }];
           }
           return prev;
         }
       });
       toast.success('Moved to Locked Folder');
     } catch (err) {
       toast.error('Failed to move to Locked Folder');
       console.error(err);
     }
   };

   const handleMoveOutOfVault = async (workspaceId: string) => {
     try {
       await updateWorkspace(workspaceId, { is_in_vault: false });
       // Optimistically update workspaces state
       setWorkspaces(prev => prev.map(ws => ws.id === workspaceId ? { ...ws, is_in_vault: false } : ws));
       // Remove from vaultWorkspaces state
       setVaultWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId));
       toast.success('Moved out of Locked Folder');
     } catch (err) {
       toast.error('Failed to move out of Locked Folder');
       console.error(err);
     }
   };

  const handleEmptyTrash = async () => {
    const trashCount = workspaces.filter(ws => ws.is_deleted).length;
    if (trashCount === 0) return;
    if (!confirm(`Permanently delete all ${trashCount} items in the trash? This action CANNOT be undone.`)) return;
    
    setLoading(true);
    try {
      await emptyTrash();
      await invalidateWorkspaceList();
      setWorkspaces(prev => prev.filter(ws => !ws.is_deleted));
      toast.success('Trash emptied');
    } catch (err) {
      toast.error('Failed to empty trash');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExportWorkspace = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    try {
      toast.info(`Preparing export for "${name}"...`);
      const [nodes, edges] = await Promise.all([
        loadCanvasNodes(id),
        loadCanvasEdges(id)
      ]);
      await exportToZip(nodes, edges, name);
      toast.success(`Exported "${name}" successfully`);
    } catch (err) {
      toast.error('Failed to export workspace');
      console.error(err);
    }
  };

  const handleRenameWorkspace = async (id: string, currentName: string) => {
    const newName = prompt('Enter new workspace name:', currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    
    try {
      await updateWorkspace(id, { name: newName.trim() });
      await invalidateWorkspaceList();
      setWorkspaces(prev => prev.map(ws => ws.id === id ? { ...ws, name: newName.trim() } : ws));
      toast.success('Workspace renamed');
    } catch (err) {
      toast.error('Failed to rename workspace');
    }
  };

  const handleUpdateTags = async (id: string, newTags: string[]) => {
    try {
      await updateWorkspace(id, { tags: newTags });
      setWorkspaces(prev => prev.map(ws => ws.id === id ? { ...ws, tags: newTags } : ws));
      toast.success('Tags updated');
    } catch (err) {
      toast.error('Failed to update tags');
    }
  };

  const handleAddTag = (id: string) => {
    const ws = workspaces.find(w => w.id === id);
    if (!ws || !tagInput.trim()) return;
    const currentTags = ws.tags || [];
    if (currentTags.includes(tagInput.trim())) return;
    const nextTags = [...currentTags, tagInput.trim()];
    handleUpdateTags(id, nextTags);
    setTagInput('');
    setEditingTagsWorkId(null);
  };

  const removeTag = (id: string, tag: string) => {
    const ws = workspaces.find(w => w.id === id);
    if (!ws) return;
    const nextTags = (ws.tags || []).filter(t => t !== tag);
    handleUpdateTags(id, nextTags);
  };

  const handleMoveToFolder = async (workspaceId: string, folderName: string | null) => {
    try {
      await updateWorkspace(workspaceId, { folder: folderName });
      setWorkspaces(prev => prev.map(ws => ws.id === workspaceId ? { ...ws, folder: folderName } : ws));
      toast.success(folderName ? `Moved to ${folderName}` : 'Removed from folder');
    } catch (err) {
      toast.error('Failed to move workspace');
    }
  };

  const handleRenameFolder = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName.trim()) return;
    const workspacesInFolder = workspaces.filter(ws => ws.folder === oldName);
    try {
      await Promise.all(workspacesInFolder.map(ws => updateWorkspace(ws.id, { folder: newName.trim() })));
      setWorkspaces(prev => prev.map(ws => ws.folder === oldName ? { ...ws, folder: newName.trim() } : ws));
      if (selectedFolder === oldName) setSelectedFolder(newName.trim());
      toast.success(`Folder renamed to "${newName.trim()}"`);
    } catch (err) {
      toast.error('Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}"? All workspaces will become unorganized.`)) return;
    const workspacesInFolder = workspaces.filter(ws => ws.folder === folderName);
    try {
      await Promise.all(workspacesInFolder.map(ws => updateWorkspace(ws.id, { folder: null })));
      setWorkspaces(prev => prev.map(ws => ws.folder === folderName ? { ...ws, folder: null } : ws));
      if (selectedFolder === folderName) setSelectedFolder(null);
      toast.success(`Folder "${folderName}" deleted`);
    } catch (err) {
      toast.error('Failed to delete folder');
    }
  };

  const createNewFolder = () => {
    if (!newFolderName.trim()) return;
    // Folders are virtual until a workspace is moved into them
    setSelectedFolder(newFolderName.trim());
    setNewFolderName('');
    setShowFolderInput(false);
    toast.info(`Folder "${newFolderName.trim()}" created (empty)`);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Initializing Interface...</p>
        </div>
      </div>
    );
  }

  const sortLabel = sortMode === 'recent' ? 'Recent' : sortMode === 'name' ? 'Name' : 'Nodes';
  const nextSort = (): SortMode => sortMode === 'recent' ? 'name' : sortMode === 'name' ? 'nodes' : 'recent';

  const allTags = Array.from(new Set(workspaces.filter(ws => !ws.is_deleted).flatMap(ws => ws.tags || []))).sort();

  return (
    <div 
      className="flex min-h-screen bg-background font-sans"
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      {/* Dashboard Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="relative flex flex-col border-r border-border bg-card overflow-x-hidden"
      >
        <div className="flex h-full flex-col p-4 w-[260px]">
          <div className="mb-8 flex items-center gap-2">
             <img src="/favicon.png" alt="ctxnote" className="h-6 w-6 object-contain" />
             <span className="text-xl font-black uppercase tracking-tighter text-foreground">CTXNOTE</span>
          </div>

          <nav className="flex-1 space-y-6">
            <section>
              <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Navigation</h3>
              <div className="space-y-1">
                <button 
                  onClick={() => setSelectedFolder(null)}
                  className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 ${!selectedFolder ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4" />
                    All Workspaces
                  </div>
                  <span className={`text-[10px] ${!selectedFolder ? 'text-primary/70' : 'text-muted-foreground'}`}>{folderCounts.all}</span>
                </button>
                <button 
                  onClick={() => setSelectedFolder('')}
                  className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 ${selectedFolder === '' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <Folder className="h-4 w-4" />
                    Unorganized
                  </div>
                  <span className={`text-[10px] ${selectedFolder === '' ? 'text-primary/70' : 'text-muted-foreground'}`}>{folderCounts.unorganized}</span>
                </button>
                 <button 
                   onClick={() => setSelectedFolder('trash')}
                    className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 ${selectedFolder === 'trash' ? 'bg-destructive/10 text-destructive' : 'text-foreground hover:bg-accent/50'}`}
                 >
                   <div className="flex items-center gap-3">
                     <Trash2 className="h-4 w-4" />
                     Trash Bin
                   </div>
                   <span className={`text-[10px] ${selectedFolder === 'trash' ? 'text-destructive/70' : 'text-muted-foreground'}`}>{folderCounts.trash}</span>
                 </button>
               </div>
             </section>
             
             <section>
               <div className="mb-3 flex items-center justify-between">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Security</h3>
               </div>
               <button 
                 onClick={() => {
                   if (isVaultLocked) {
                     setVaultModalMode(undefined);
                      setShowVaultModal(true);
                   } else {
                     setSelectedFolder('vault');
                   }
                 }}
                 className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 ${selectedFolder === 'vault' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent/50'}`}
               >
                 <div className="flex items-center gap-3">
                   {isVaultLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                   Locked Folder
                 </div>
                 <span className={`text-[10px] ${selectedFolder === 'vault' ? 'text-primary/70' : 'text-muted-foreground'}`}>
                   {isVaultLocked ? 'Locked' : vaultWorkspaces.length}
                 </span>
               </button>
               {selectedFolder === 'vault' && !isVaultLocked && (
                 <button
                   onClick={() => {
                     useVaultStore.getState().lockVault();
                     setSelectedFolder(null);
                   }}
                   className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200"
                 >
                   <Lock className="h-3.5 w-3.5" />
                   Lock Vault
                 </button>
               )}
             </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Folders</h3>
                <button 
                  onClick={() => setShowFolderInput(true)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              
              <div className="space-y-1">
                {showFolderInput && (
                  <div className="px-2 pb-2">
                    <input
                      autoFocus
                      className="w-full rounded border-2 border-border bg-background px-2 py-1.5 text-xs font-bold outline-none focus:border-primary"
                      placeholder="Folder name..."
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') createNewFolder();
                        if (e.key === 'Escape') setShowFolderInput(false);
                      }}
                      onBlur={() => !newFolderName && setShowFolderInput(false)}
                    />
                  </div>
                )}
                {allFolders.map(folder => (
                  <div key={folder} className="group relative">
                    <button 
                      onClick={() => setSelectedFolder(folder)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 ${selectedFolder === folder ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent/50'}`}
                    >
                      <Folder className={`h-4 w-4 flex-shrink-0 transition-colors ${selectedFolder === folder ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                      <span className="truncate flex-1 text-left" title={folder}>{folder}</span>
                      <span className={`text-[10px] ${selectedFolder === folder ? 'text-primary/70' : 'text-muted-foreground'}`}>{folderCounts[folder]}</span>
                    </button>
                    
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={`p-1 rounded hover:bg-accent ${selectedFolder === folder ? 'text-primary-foreground hover:text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 border border-border shadow-[var(--clay-shadow-sm)]">
                          <DropdownMenuItem onClick={() => {
                            const newName = prompt('New folder name:', folder);
                            if (newName) handleRenameFolder(folder, newName);
                          }}>
                            <Edit2 className="mr-2 h-3.5 w-3.5" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteFolder(folder)}
                            className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            <span>Delete Folder</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                {allFolders.length === 0 && !showFolderInput && (
                  <p className="px-3 py-2 text-[10px] font-medium text-muted-foreground italic">No folders yet</p>
                )}
              </div>
            </section>
          </nav>

          <div className="pt-4 border-t border-border space-y-1">
            {canInstall && (
              <button
                onClick={installApp}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all border border-primary/20 mb-2 group animate-pulse"
              >
                <Download className="h-4 w-4 group-hover:bounce" />
                Install App
              </button>
            )}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition-all"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-all"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </motion.aside>

      <HotkeySettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <ImportModal open={showImport} onOpenChange={(open) => { setShowImport(open); if (!open) setImportFiles(null); }} initialFiles={importFiles} />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-border/40 bg-card/80 backdrop-blur-md px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="rounded-lg border border-border/50 bg-card p-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200 hover:shadow-sm"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                {selectedFolder === null ? 'All Workspaces' : selectedFolder === '' ? 'Unorganized' : selectedFolder === 'trash' ? 'Trash Bin' : selectedFolder}
              </h2>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">{sortedWorkspaces.length} boards</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search boards..."
                className="rounded-lg border border-border/50 bg-card/50 pl-9 pr-3 py-1.5 text-xs font-bold text-foreground outline-none transition-all duration-200 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/10 w-40 sm:w-64"
              />
            </div>
            <button
              onClick={() => setSortMode(nextSort())}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200 hover:shadow-sm active:scale-95"
            >
              <SortAsc className="h-3.5 w-3.5" />
              {sortLabel}
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="rounded-lg border border-border/50 bg-card/50 p-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200 hover:shadow-sm active:scale-95"
            >
              {viewMode === 'grid' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200 hover:shadow-sm active:scale-95"
            >
              <FileUp className="h-3.5 w-3.5" />
              Import
            </button>
            {selectedFolder === 'trash' && folderCounts.trash > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-destructive hover:bg-destructive/20 transition-all duration-200 hover:shadow-sm active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Empty Trash
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="mx-auto max-w-7xl">
            <BrandingBanner />
            {/* Tags Filter Bar */}
            {allTags.length > 0 && (
              <div className="mb-8 flex flex-wrap items-center gap-2 animate-fade-in">
                <span className="mr-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filter:</span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${!selectedTag ? 'bg-primary/20 text-primary border border-primary' : 'bg-card text-muted-foreground border border-border hover:border-primary'}`}
                >
                  All Tags
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${selectedTag === tag ? 'bg-primary/20 text-primary border border-primary' : 'bg-card text-muted-foreground border border-border hover:border-primary'}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

          {!loading && workspaces.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/30 backdrop-blur-sm py-16 animate-in fade-in zoom-in-95 duration-500">
              <Layers className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No workspaces yet. Create one to get started!</p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  Create Workspace
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent/50 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <FileUp className="h-4 w-4" />
                  Import Knowledge
                </button>
              </div>
            </div>
          )}

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex h-44 animate-pulse rounded-xl border border-border/50 bg-card/50" />
              ))}
              {!loading && workspaces.length > 0 && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="group flex h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card/80 hover:shadow-md hover:-translate-y-1 active:scale-[0.98] animate-in fade-in"
                >
                  <Plus className="h-8 w-8 text-muted-foreground/70 transition-all duration-500 group-hover:text-primary group-hover:rotate-90" />
                  <span className="text-sm font-semibold tracking-wide text-muted-foreground transition-colors group-hover:text-primary">
                    New Workspace
                  </span>
                </button>
              )}
              {sortedWorkspaces.map((ws, idx) => (
                <motion.div
                  key={ws.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  className="group relative flex h-44 cursor-pointer flex-col justify-between rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:bg-card active:scale-[0.98]"
                >
                  {(() => {
                    const { icon: WsIcon, color: iconColor } = getIconForColor(ws.color); return (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/50 shadow-sm" style={{ backgroundColor: iconColor + '15' }}>
                          <WsIcon className="h-4 w-4" style={{ color: iconColor }} />
                        </div>
                        <span className="truncate text-sm font-bold tracking-wide text-foreground">{ws.name}</span>
                      </div>
                    );
                  })()}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Layers className="h-3 w-3" />
                      {nodeCounts[ws.id] ?? '…'} nodes
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(ws.updated_at), { addSuffix: true })}
                    </div>
                  </div>

                  {/* Tags display */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(ws.tags || []).map(t => (
                      <span key={t} className="rounded bg-accent/50 px-1.5 py-0.5 text-[9px] font-bold text-foreground">
                        #{t}
                      </span>
                    ))}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingTagsWorkId(editingTagsWorkId === ws.id ? null : ws.id); }}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      + TAG
                    </button>
                    {editingTagsWorkId === ws.id && (
                      <div className="mt-1 flex w-full gap-1" onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          className="h-6 flex-1 rounded border border-border bg-background px-2 text-[10px] font-bold"
                          placeholder="tag name..."
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddTag(ws.id)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="absolute right-3 top-3 flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          onClick={e => e.stopPropagation()}
                          className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all duration-200 hover:bg-accent/80 hover:text-foreground group-hover:opacity-100 backdrop-blur-sm"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 max-h-[60vh] overflow-y-auto overflow-x-hidden border border-border/50 bg-card/95 backdrop-blur-xl shadow-xl rounded-xl">
                        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Workspace Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleFavorite(ws.id); }}>
                          <Star className={`mr-2 h-4 w-4 ${favorites.has(ws.id) ? 'fill-primary text-primary' : ''}`} />
                          <span>{favorites.has(ws.id) ? 'Unfavorite' : 'Favorite'}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameWorkspace(ws.id, ws.name); }}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          <span>Rename</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(e, ws); }}>
                          <Copy className="mr-2 h-4 w-4" />
                          <span>Duplicate</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleExportWorkspace(e, ws.id, ws.name)}>
                          <FileDown className="mr-2 h-4 w-4 text-primary" />
                          <span className="font-bold text-primary">Export ZIP</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleManagePassword(ws.id); }}>
                          <Shield className="mr-2 h-4 w-4" />
                          <span>{ws.is_password_protected ? 'Change Password' : 'Set Password'}</span>
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest">Move to Folder</DropdownMenuLabel>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToFolder(ws.id, null); }}>
                          <Layers className="mr-2 h-4 w-4" />
                          <span>Unorganized</span>
                        </DropdownMenuItem>
                        {allFolders.map(folder => (
                          <DropdownMenuItem key={folder} onClick={(e) => { e.stopPropagation(); handleMoveToFolder(ws.id, folder); }}>
                            <Folder className="mr-2 h-4 w-4 text-primary" />
                            <span>{folder}</span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onClick={(e) => { 
                          e.stopPropagation(); 
                          const newName = prompt('Enter name for the new folder:');
                          if (newName) handleMoveToFolder(ws.id, newName.trim());
                        }}>
                          <Plus className="mr-2 h-4 w-4" />
                          <span>New Folder...</span>
                        </DropdownMenuItem>

                         <DropdownMenuSeparator />
                         {selectedFolder === 'vault' ? (
                           <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveOutOfVault(ws.id); }}>
                             <Unlock className="mr-2 h-4 w-4" />
                             <span>Move out of Locked Folder</span>
                           </DropdownMenuItem>
                         ) : (
                           <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToVault(ws.id); }}>
                             <Lock className="mr-2 h-4 w-4" />
                             <span>Move to Locked Folder</span>
                           </DropdownMenuItem>
                         )}
                         <DropdownMenuSeparator />
                         {selectedFolder === 'trash' ? (
                           <>
                             <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRestore(ws.id); }}>
                               <RotateCcw className="mr-2 h-4 w-4 text-primary" />
                               <span>Restore</span>
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                               onClick={(e) => { e.stopPropagation(); handlePermanentDelete(ws.id); }}
                               className="text-destructive focus:bg-destructive focus:text-destructive-foreground font-bold"
                             >
                               <Trash2 className="mr-2 h-4 w-4" />
                               <span>Delete Permanently</span>
                             </DropdownMenuItem>
                           </>
                         ) : (
                           <DropdownMenuItem 
                             onClick={(e) => { e.stopPropagation(); handleDelete(e, ws.id); }}
                             className="text-destructive focus:bg-destructive focus:text-destructive-foreground font-bold"
                           >
                             <Trash2 className="mr-2 h-4 w-4" />
                             <span>Move to Trash</span>
                           </DropdownMenuItem>
                         )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="relative">
                      <button
                        onMouseEnter={() => setShowStatsId(ws.id)}
                        onMouseLeave={() => setShowStatsId(null)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all duration-200 hover:text-primary hover:bg-primary/10 group-hover:opacity-100"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      {showStatsId === ws.id && (
                        <div className="absolute right-0 top-10 z-[100] w-56 rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl p-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                          <p className="mb-3 text-xs font-semibold text-primary border-b border-border/50 pb-2">Workspace Info</p>
                          <div className="space-y-3 font-medium text-foreground">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] uppercase">Nodes</span>
                              </div>
                              <span className="text-xs">{nodeCounts[ws.id] ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] uppercase">Created</span>
                              </div>
                              <span className="text-xs">{new Date(ws.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] uppercase">Modified</span>
                              </div>
                              <span className="text-xs">{formatDistanceToNow(new Date(ws.updated_at))} ago</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            /* List view */
            <div className="space-y-2">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-card" />
              ))}
              {!loading && workspaces.length > 0 && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 backdrop-blur-sm px-5 py-3.5 text-sm font-semibold tracking-wide text-muted-foreground transition-all duration-300 hover:border-primary/50 hover:text-primary hover:bg-card/80 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
                >
                  <Plus className="h-4 w-4" />
                  New Workspace
                </button>
              )}
              {sortedWorkspaces.map((ws, idx) => (
                <motion.div
                  key={ws.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm px-5 py-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:bg-card active:scale-[0.99]"
                >
                  {(() => {
                    const { icon: WsIcon, color: iconColor } = getIconForColor(ws.color); return (
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/50 flex-shrink-0 shadow-sm" style={{ backgroundColor: iconColor + '15' }}>
                        <WsIcon className="h-4 w-4" style={{ color: iconColor }} />
                      </div>
                    );
                  })()}
                  <span className="flex-1 truncate text-sm font-bold tracking-wide text-foreground">{ws.name}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{nodeCounts[ws.id] ?? '…'} nodes</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{formatDistanceToNow(new Date(ws.updated_at), { addSuffix: true })}</span>
                  <div className="flex items-center gap-1">
                    {selectedFolder === 'trash' ? (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleRestore(ws.id); }} className="rounded p-1 text-primary opacity-0 group-hover:opacity-100 hover:bg-primary/10" title="Restore">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handlePermanentDelete(ws.id); }} className="rounded p-1 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10" title="Delete Permanently">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(ws.id); }} className={`rounded p-1 transition-all ${favorites.has(ws.id) ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'}`}>
                          <Star className={`h-3.5 w-3.5 ${favorites.has(ws.id) ? 'fill-primary' : ''}`} />
                        </button>
                        <button onClick={(e) => handleDuplicate(e, ws)} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary" title="Duplicate">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => handleDelete(e, ws.id)} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive" title="Move to Trash">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>

    {/* Create workspace modal */}
    {showCreate && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
            <h3 className="mb-4 text-lg font-bold tracking-tight text-foreground">New Workspace</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Study Board"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-foreground">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {WORKSPACE_ICONS.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => setNewIcon(idx)}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all duration-200 ${newIcon === idx ? 'scale-110 border-primary bg-primary/10 shadow-md ring-2 ring-primary/20' : 'border-border/50 hover:scale-105 hover:border-border hover:bg-accent/50'}`}
                        title={item.label}
                      >
                        <IconComp className="h-4.5 w-4.5" style={{ color: item.color }} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all duration-200 ${selectedTemplate === null ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border/50 text-muted-foreground hover:border-border hover:bg-accent/50 hover:text-foreground'}`}
                  >
                    ✨ Blank
                  </button>
                  {canvasTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all duration-200 ${selectedTemplate === t.id ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border/50 text-muted-foreground hover:border-border hover:bg-accent/50 hover:text-foreground'}`}
                    >
                      {t.emoji} {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={isPasswordProtected}
                    onChange={(e) => setIsPasswordProtected(e.target.checked)}
                    className="rounded border-border"
                  />
                  Password Protect Workspace
                </label>
                {isPasswordProtected && (
                  <div className="space-y-2 pl-6">
                    <input
                      type="password"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                    <input
                      type="password"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowCreate(false); setSelectedTemplate(null); }}
                  className="rounded-lg border border-border/50 bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/50 transition-all duration-200 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-sm disabled:opacity-50 active:scale-95"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <PasswordManageDialog
        isOpen={showPasswordManageDialog}
        onClose={() => {
          setShowPasswordManageDialog(false);
          setPasswordManageWorkspaceId(null);
        }}
        onSetPassword={handleSetPassword}
        onRemovePassword={handleRemovePassword}
        hasPassword={workspaces.find(w => w.id === passwordManageWorkspaceId)?.is_password_protected || false}
      />

      <VaultModal
        isOpen={showVaultModal}
        onClose={() => setShowVaultModal(false)}
        initialMode={vaultModalMode}
        onUnlocked={() => {
          setSelectedFolder('vault');
        }}
      />
    </div>
  );
};

export default Dashboard;
