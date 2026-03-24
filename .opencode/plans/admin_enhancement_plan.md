# Admin Panel Enhancement Plan

## Overview
This document outlines the planned enhancements to the `/admin` panel to give it complete access to all system functionalities.

## Current State Analysis
Based on code review:
- Admin page exists at `src/pages/AdminPage.tsx` with tabs for Overview, Users, Workspaces, Storage
- Admin data hooks in `src/hooks/useAdminData.ts`
- Node counting is broken (shows 0) because nodes are in subcollections `workspaces/{workspaceId}/nodes`
- Admin check uses hardcoded email instead of role-based check
- Missing several management tabs for comprehensive admin control

## Planned Enhancements

### 1. Fix Node Counting (High Priority)
**Issue**: Node count shows 0 in admin stats and workspace list
**Solution**: Use collection group queries to count nodes across all workspaces

**Changes needed in `src/hooks/useAdminData.ts`**:
- Import `collectionGroup` from firebase/firestore
- Replace node counting logic in `useAdminStats()`:
  ```typescript
  // Before:
  const nodesSnap = await getDocs(query(collection(db, 'nodes')));
  const totalNodesCount = 0; // Fallback
  
  // After:
  const nodesSnap = await getDocs(query(collectionGroup(db, 'nodes')));
  const totalNodesCount = nodesSnap.size;
  ```
- Update workspace node counting in `useAdminWorkspaces()` to use collection group or workspace-specific query

### 2. Add Global Settings Tab (High Priority)
**New tab for managing application-wide settings**

**Components needed**:
- `src/components/admin/GlobalSettingsTab.tsx`
- Settings schema in Firestore (collection: `system_settings`, document: `global`)
- Hook: `src/hooks/useGlobalSettings.ts`

**Features**:
- Site title/configuration
- Maintenance mode toggle
- Registration enable/disable
- File upload limits
- AI service configuration
- Integration toggles (Google Drive, etc.)

### 3. Enhance Users Tab with Role Management (High Priority)
**Allow admins to change user roles between admin and regular user**

**Changes needed in `src/hooks/useAdminData.ts`**:
- Update `AdminUser` interface to include mutable role field
- Add `updateUserRole` function in `useAdminUsers()`
- Update Firestore queries to read/write role field

**UI Changes in `src/pages/AdminPage.tsx`**:
- Add role dropdown/badge in UsersTable
- Add role change confirmation dialog
- Prevent self-demotion safety check

### 4. Enhance Workspaces Tab with Management Controls (High Priority)
**Allow changing workspace owner, public/private status, and color**

**Changes needed in `src/hooks/useAdminData.ts`**:
- Update `AdminWorkspace` interface
- Add `updateWorkspace` function in `useAdminWorkspaces()`
- Functions for: changeOwner, togglePublic, updateColor

**UI Changes**:
- Add owner selection dropdown (list of users)
- Add public/private toggle switch
- Add color picker/input
- Add confirmation dialogs for sensitive changes

### 5. Add Pending Operations Tab (Medium Priority)
**View and manage IndexedDB offline sync queue**

**Components needed**:
- `src/components/admin/PendingOpsTab.tsx`
- Hook: `src/hooks/usePendingOps.ts` (read from IndexedDB)

**Features**:
- List of pending operations by type
- Timestamp and details for each op
- Manual retry failed operations
- Clear queue option
- Auto-refresh when online status changes

### 6. Add Cache Management Tab (Medium Priority)
**Clear IndexedDB and local storage**

**Components needed**:
- `src/components/admin/CacheManagementTab.tsx`
- Utilities for clearing different cache types

**Features**:
- Button to clear IndexedDB stores (canvas-nodes, canvas-edges, etc.)
- Button to clear localStorage/sessionStorage
- Button to clear service worker cache (PWA)
- Confirmation dialogs with warnings
- Status indicators showing cache sizes

### 7. Update Admin Check to Use Role Field (High Priority)
**Check Firestore user role field with fallback to hardcoded email**

**Changes needed in `src/hooks/useAdminData.ts`**:
- Modify `useAdminCheck()` to:
  1. Check if user document has `role: "admin"` field
  2. Fallback to hardcoded email check for backwards compatibility
  3. Handle case where user document doesn't exist

**Implementation**:
```typescript
export function useAdminCheck() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    
    // Check Firestore for role field
    const userDocRef = doc(db, 'users', user.uid);
    getDoc(userDocRef).then(snap => {
      if (snap.exists() && snap.data().role === 'admin') {
        setIsAdmin(true);
      } else {
        // Fallback to hardcoded email
        setIsAdmin(user.email === ADMIN_EMAIL);
      }
    }).catch(() => {
      // On error, fallback to email check
      setIsAdmin(user.email === ADMIN_EMAIL);
    });
  }, [user]);

  return isAdmin;
}
```

### 8. Add AI Service Management Tab (Medium Priority)
**View AI usage statistics and manage API keys**

**Components needed**:
- `src/components/admin/AIManagementTab.tsx`
- Hook: `src/hooks/useAIService.ts`

**Features**:
- Display AI usage metrics (tokens used, requests made)
- List configured AI providers
- Allow updating API keys (with validation)
- Show cost estimates
- Rate limit information

### 9. Add Integrations Management Tab (Medium Priority)
**Manage Google Drive and R2 storage integrations**

**Components needed**:
- `src/components/admin/IntegrationsTab.tsx`
- Hooks: `src/hooks/useGoogleDrive.ts`, `src/hooks/useR2Storage.ts`

**Features**:
- Google Drive connection status
- Re-authentication button for Google Drive
- Folder mapping configuration
- R2 storage bucket status
- Storage usage per integration
- Test connection functionality

## Implementation Order Recommendation

1. **Fix node counting** - Critical for accurate admin dashboard
2. **Update admin check** - Security improvement for proper role-based access
3. **Enhance Users tab with role management** - Core admin functionality
4. **Enhance Workspaces tab** - Core admin functionality
5. **Add Global Settings tab** - Centralized configuration
6. **Add Pending Operations tab** - Debugging and reliability
7. **Add Cache Management tab** - Maintenance and troubleshooting
8. **Add AI Service Management tab** - Monitoring and cost control
9. **Add Integrations Management tab** - External service management

## Database Schema Changes Needed

### Users Collection
Add/update role field:
```typescript
{
  // existing fields...
  role: 'admin' | 'user', // default: 'user'
  // or support multiple roles: roles: string[] // ['admin', 'user']
}
```

### System Settings Collection
New collection for global settings:
```
/system_settings (collection)
  /global (document)
    {
      siteTitle: string,
      maintenanceMode: boolean,
      registrationEnabled: boolean,
      maxUploadSizeMB: number,
      // AI settings
      aiProvider: string,
      // Feature flags
      enableGoogleDrive: boolean,
      enableR2: boolean,
      // etc.
    }
```

## Safety Considerations
1. **Role changes**: Prevent admins from removing their own admin privileges
2. **Workspace deletion**: Add extra confirmation for workspace deletion
3. **Data exports**: Consider audit logging for sensitive operations
4. **Rate limiting**: Protect expensive operations from abuse
5. **Backup reminders**: Warn before destructive operations

## Files to Create/Modify

### New Files:
- `src/components/admin/GlobalSettingsTab.tsx`
- `src/components/admin/PendingOpsTab.tsx`
- `src/components/admin/CacheManagementTab.tsx`
- `src/components/admin/AIManagementTab.tsx`
- `src/components/admin/IntegrationsTab.tsx`
- `src/hooks/useGlobalSettings.ts`
- `src/hooks/usePendingOps.ts`
- `src/hooks/useAIService.ts`
- `src/hooks/useGoogleDrive.ts` (if not exists)
- `src/hooks/useR2Storage.ts` (if not exists)

### Modified Files:
- `src/pages/AdminPage.tsx` (add new tabs)
- `src/hooks/useAdminData.ts` (fixes and enhancements)
- `src/lib/firebase/client.ts` (if needed for new queries)
- `firestore.indexes.json` (add indexes for new queries)

## Testing Checklist
- [ ] Node counts display correctly in all admin views
- [ ] Role-based admin check works with Firestore role field
- [ ] Fallback to email check works when role field missing
- [ ] Users tab allows role changes with proper validation
- [ ] Workspaces tab allows owner, public/private, and color changes
- [ ] Global settings persist and affect application behavior
- [ ] Pending operations tab shows accurate queue status
- [ ] Cache management clears appropriate storage types
- [ ] AI service tab shows usage statistics
- [ ] Integrations tab manages external service connections
- [ ] All changes work offline/online sync correctly
- [ ] No regression in existing admin functionality