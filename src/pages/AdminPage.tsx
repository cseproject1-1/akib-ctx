import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Users, LayoutGrid, BarChart3, Trash2, Shield, ArrowLeft, HardDrive, FolderOpen, Database } from 'lucide-react';
import { useAdminCheck, useAdminStats, useAdminUsers, useAdminWorkspaces, useAdminStorage } from '@/hooks/useAdminData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Link } from 'react-router-dom';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function OverviewTab() {
  const { stats, loading } = useAdminStats();
  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const storageUsedGB = (stats?.totalStorageBytes || 0) / (1024 * 1024 * 1024);
  const storageLimitGB = 10; // 10GB default for free tier
  const storagePercent = Math.min((storageUsedGB / storageLimitGB) * 100, 100);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats?.totalUsers ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats?.totalWorkspaces ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats?.totalNodes ?? 0}</div></CardContent>
        </Card>
      </div>

      {/* Storage Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cloud Storage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold">{formatBytes(stats?.totalStorageBytes || 0)}</div>
            <span className="text-sm text-muted-foreground">{stats?.totalFiles ?? 0} files</span>
          </div>
          <Progress value={storagePercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {storageUsedGB.toFixed(3)} GB of {storageLimitGB} GB used ({storagePercent.toFixed(1)}%)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StorageTab() {
  const { storage, loading } = useAdminStorage();
  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const totalBytes = storage?.totalBytes || 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatBytes(totalBytes)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{storage?.totalFiles ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workspaces Using Storage</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {storage?.workspaces?.filter((w) => w.storage_bytes > 0).length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Storage by Workspace</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Usage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {storage?.workspaces?.map((w) => {
                const percent = totalBytes > 0 ? (w.storage_bytes / totalBytes) * 100 : 0;
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: w.color }} />
                        <span className="font-medium">{w.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{w.owner_name}</TableCell>
                    <TableCell>{w.file_count}</TableCell>
                    <TableCell className="font-medium">{formatBytes(w.storage_bytes)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={percent} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-12 text-right">{percent.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!storage?.workspaces || storage.workspaces.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No storage data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const { users, loading, deleteUser } = useAdminUsers();
  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Workspaces</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.display_name || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  {u.roles.map((r) => (
                    <Badge key={r} variant={r === 'admin' ? 'default' : 'secondary'} className="mr-1">
                      {r}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>{u.workspace_count}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete user?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>{u.display_name || u.email}</strong> and all their data. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteUser(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WorkspacesTab() {
  const { workspaces, loading, deleteWorkspace } = useAdminWorkspaces();
  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Nodes</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Public</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaces.map((w) => (
              <TableRow key={w.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: w.color }} />
                    <span className="font-medium">{w.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{w.owner_name}</TableCell>
                <TableCell>{w.node_count}</TableCell>
                <TableCell className="text-muted-foreground">{formatBytes(w.storage_bytes)}</TableCell>
                <TableCell>
                  <Badge variant={w.is_public ? 'default' : 'outline'}>{w.is_public ? 'Public' : 'Private'}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>{w.name}</strong> and all its nodes/edges. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteWorkspace(w.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {workspaces.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No workspaces found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const isAdmin = useAdminCheck();

  if (isAdmin === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Admin Panel</h1>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="workspaces"><WorkspacesTab /></TabsContent>
          <TabsContent value="storage"><StorageTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
