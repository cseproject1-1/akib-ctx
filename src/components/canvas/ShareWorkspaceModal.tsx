import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Share2, Check, Globe, GlobeLock } from 'lucide-react';
import { db, auth } from '@/lib/firebase/client';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { toast } from 'sonner';

interface ShareWorkspaceModalProps {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

import { forwardRef } from 'react';

export const ShareWorkspaceModal = forwardRef<HTMLDivElement, ShareWorkspaceModalProps>(function ShareWorkspaceModal({ workspaceId, workspaceName, onClose }, ref) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'read' | 'edit'>('read');
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState<Record<string, unknown>[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const loadPublicStatus = useCallback(async () => {
    const wsRef = doc(db, 'workspaces', workspaceId);
    const snap = await getDoc(wsRef);
    if (snap.exists()) {
      setIsPublic(!!snap.data().is_public);
    }
  }, [workspaceId]);

  const loadShares = useCallback(async () => {
    const q = query(collection(db, 'workspace_shares'), where('workspace_id', '==', workspaceId));
    const snap = await getDocs(q);
    setShares(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoaded(true);
  }, [workspaceId]);

  useEffect(() => {
    loadShares();
    loadPublicStatus();
  }, [loadShares, loadPublicStatus]);

  const togglePublic = async () => {
    setTogglingPublic(true);
    try {
      const newVal = !isPublic;
      const wsRef = doc(db, 'workspaces', workspaceId);
      await updateDoc(wsRef, { is_public: newVal });
      setIsPublic(newVal);
      toast.success(newVal ? 'Workspace is now public' : 'Workspace is now private');
    } catch {
      toast.error('Failed to update');
    } finally {
      setTogglingPublic(false);
    }
  };

  const handleShare = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      await addDoc(collection(db, 'workspace_shares'), {
        workspace_id: workspaceId,
        shared_by: user.uid,
        shared_with_email: email.trim().toLowerCase(),
        permission,
        created_at: new Date().toISOString()
      });

      await updateDoc(doc(db, 'workspaces', workspaceId), {
        shared_with: arrayUnion(email.trim().toLowerCase())
      });

      toast.success(`Shared with ${email}`);
      setEmail('');
      loadShares();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to share');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string, shareEmail: string) => {
    await deleteDoc(doc(db, 'workspace_shares', shareId));
    await updateDoc(doc(db, 'workspaces', workspaceId), {
      shared_with: arrayRemove(shareEmail)
    });
    toast.success('Access removed');
    loadShares();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/view/${workspaceId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied');
  };

  return (
    <div ref={ref} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[var(--clay-shadow-lg)] animate-brutal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-black uppercase tracking-wider text-foreground">Share Workspace</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
          {workspaceName}
        </p>

        {/* Public toggle */}
        <div className="mb-4 flex items-center justify-between rounded-lg border-2 border-border bg-accent/50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            {isPublic ? <Globe className="h-4 w-4 text-green" /> : <GlobeLock className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-bold text-foreground">{isPublic ? 'Public' : 'Private'}</p>
              <p className="text-[10px] text-muted-foreground">{isPublic ? 'Anyone with the link can view' : 'Only invited people can view'}</p>
            </div>
          </div>
          <button
            onClick={togglePublic}
            disabled={togglingPublic}
            className={`relative h-6 w-11 rounded-full border-2 transition-all ${isPublic ? 'border-green bg-green' : 'border-border bg-muted'
              }`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card transition-all shadow ${isPublic ? 'left-[22px]' : 'left-0.5'
              }`} />
          </button>
        </div>

        {/* Copy link */}
        <button
          onClick={handleCopyLink}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border bg-accent px-4 py-2.5 text-sm font-bold transition-all hover:border-primary"
        >
          {copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : isPublic ? 'Copy public view link' : 'Copy view link (private)'}
        </button>

        {/* Invite by email */}
        <div className="flex gap-2 mb-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 rounded-lg border-2 border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleShare(); }}
          />
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as 'read' | 'edit')}
            className="rounded-lg border-2 border-border bg-input px-2 py-2 text-xs font-bold uppercase text-foreground outline-none focus:border-primary"
          >
            <option value="read">Read</option>
            <option value="edit">Edit</option>
          </select>
        </div>
        <button
          onClick={handleShare}
          disabled={loading || !email.trim()}
          className="mb-5 w-full rounded-lg bg-primary py-2.5 text-sm font-black uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
        >
          {loading ? 'Sharing…' : 'Invite by Email'}
        </button>

        {/* Shared users */}
        {shares.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">People with access</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {shares.map((s) => (
                <div key={s.id as string} className="flex items-center justify-between rounded-lg border border-border bg-accent/50 px-3 py-2">
                  <div>
                    <span className="text-sm font-semibold text-foreground">{s.shared_with_email as string}</span>
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${(s.permission as string) === 'edit' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                      {s.permission as string}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveShare(s.id as string, s.shared_with_email as string)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
