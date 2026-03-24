# AGENTS.md

Instructions for agentic coding agents working in this repository.

## Build / Lint / Test Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (port 8080) |
| `npm run build` | Production build |
| `npm run build:dev` | Development mode build |
| `npm run lint` | Run ESLint on all files |
| `npm run test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `firebase deploy` | Deploy to Firebase (requires CLI) |

**Running a single test file:**
```bash
npx vitest run src/test/example.test.ts
```

**Running tests matching a name:**
```bash
npx vitest run -t "should pass"
```

Tests live in `src/test/` and `src/__tests__/`. Test files must match `*.{test,spec}.{ts,tsx}`.

## Architecture

CtxNote is a non-linear knowledge base app built with React 18, Vite, Tailwind CSS, and Firebase Firestore. It renders an infinite canvas powered by `@xyflow/react` with offline support via IndexedDB.

### Key Directories

- `src/components/` — UI components (Shadcn UI primitives in `ui/`, custom canvas nodes in `nodes/`)
- `src/store/` — Zustand stores (`canvasStore.ts`, `settingsStore.ts`, `vaultStore.ts`)
- `src/lib/cache/` — IndexedDB wrapper (`indexedDB.ts`) and sync manager (`canvasCache.ts`)
- `src/lib/firebase/` — Server-side Firestore data access
- `src/hooks/` — Custom React hooks
- `src/types/` — Shared TypeScript types (`canvas.ts`)
- `src/pages/` — Route-level page components
- `src/mobile/` — Mobile-specific pages and components
- `src/contexts/` — React context providers

### Data Flow

State lives in Zustand stores. Writes go through a write-through cache that persists to IndexedDB and queues failed writes as `PendingOp` for replay when back online. Firebase Firestore is the source of truth for synced data.

### Path Alias

`@/` maps to `src/` via Vite and TypeScript config. Always use `@/` instead of relative `../../` paths.

```ts
import { useCanvasStore } from '@/store/canvasStore';
```

## Code Style

### Formatting

- **Quotes**: Single quotes for JS/TS strings. Double quotes in JSX attributes.
- **Semicolons**: Always use semicolons.
- **Indentation**: 2 spaces.
- **Line length**: No hard limit, but keep lines under ~120 chars for readability.
- **Trailing commas**: Used in multiline arrays and objects.

### Imports

- Use the `@/` alias for all `src/` imports.
- Group imports: (1) React/library imports, (2) internal `@/` imports, (3) relative imports.
- Use `import type { ... }` for type-only imports when possible.
- Destructure imports when feasible: `import { useState, useEffect } from 'react'`.

### Types

- TypeScript is configured with `strict: false` and `noImplicitAny: false`. You may use `any` where necessary, but prefer explicit types.
- Define shared interfaces in `src/types/`. Use union types for node data variants (see `canvas.ts`).
- Zustand store state should have an explicit interface before the `create<>` call.
- Use `Record<K, V>` for dictionary-like objects.

### Naming Conventions

- **Files**: `camelCase.ts` for utilities/hooks/stores, `PascalCase.tsx` for components.
- **Hooks**: Prefix with `use` (e.g., `useSyncManager`, `useNetworkStatus`).
- **Zustand stores**: `use<Name>Store` (e.g., `useCanvasStore`).
- **Private store fields**: Prefix with underscore (e.g., `_saveCounter`, `_skipSync`).
- **Constants**: `UPPER_SNAKE_CASE` for module-level constants.
- **Types/Interfaces**: `PascalCase`.

### Components

- Use function declarations for components: `function MyComponent() { ... }`.
- Use arrow functions for inline/small components in the same file.
- Export default for page-level components; named exports for shared components.
- Shadcn UI components in `src/components/ui/` follow the standard Shadcn pattern with `cn()` utility from `@/lib/utils`.

### Error Handling

- IndexedDB operations silently catch errors and log with `[DB]` prefix. Do not throw from cache operations.
- Guard against `NaN` in numeric operations (positions, counters) — this codebase has defensive checks like `isNaN(x) ? 0 : x`.
- Use optional chaining and nullish coalescing for nullable data: `data?.title ?? 'Untitled'`.

### State & Side Effects

- Use Zustand stores for global state, not React Context (except for Auth).
- Use `structuredClone()` for deep cloning state snapshots (undo/redo, clipboard).
- Filter `null`/`undefined` values before writing to Firestore to prevent sync errors.
- Use `queueMicrotask()` or `setTimeout` for deferring non-urgent state updates.

### Styling

- Tailwind CSS with `cn()` utility (clsx + tailwind-merge) for conditional classes.
- Shadcn UI components use `class-variance-authority` for variant-based styling.
- Dark mode via `next-themes`.

### ESLint

Configured with `typescript-eslint`, `react-hooks`, and `react-refresh` plugins. `@typescript-eslint/no-unused-vars` is disabled. Run `npm run lint` before committing.

## Backend Architecture

### Overview

The backend is entirely **serverless** — there is no traditional backend server. CtxNote uses **Firebase Firestore** as the source of truth for data and **IndexedDB** as a local-first cache layer. A **Cloudflare Worker** handles AI/metadata tasks (optional, configured via `VITE_WORKER_URL`).

### Firebase Setup (`src/lib/firebase/client.ts`)

- Firebase is initialized via `initializeApp` using env vars (`VITE_FIREBASE_*`).
- Exports: `auth` (Firebase Auth), `db` (Firestore with `ignoreUndefinedProperties: true`), `functions` (Cloud Functions), `app`.
- Firestore offline persistence is enabled via `enableIndexedDbPersistence()`.

### Authentication (`src/contexts/AuthContext.tsx`)

- **Provider**: `AuthProvider` wraps the app via React Context.
- **Methods**: `signUp`, `signIn`, `signInWithGoogle`, `signOut`, `sendVerification`.
- **Email/password**: `createUserWithEmailAndPassword` + `sendEmailVerification`. User profile stored in `users/{uid}` with fields: `email`, `display_name`, `role`, `created_at`.
- **Google**: `signInWithPopup` with `GoogleAuthProvider`. Profile created on first login only.
- **Admin check**: Hardcoded email `mm.adnanakib@gmail.com` gets `role: 'admin'`.
- **Sign out**: Clears all IndexedDB caches before calling `firebaseSignOut`.
- **HMR safety**: `useAuth()` returns safe defaults if context is missing during hot reload.

### Firestore Collections

| Collection | Path | Description |
|---|---|---|
| `users` | `users/{uid}` | User profiles, settings |
| `workspaces` | `workspaces/{wsId}` | Workspace metadata (name, color, user_id, tags, folder, is_deleted, password_hash, is_in_vault) |
| `nodes` | `workspaces/{wsId}/nodes/{nodeId}` | Canvas nodes (id, type, position_x/y, width/height, data, z_index, created_at, updated_at) |
| `edges` | `workspaces/{wsId}/edges/{edgeId}` | Canvas edges (id, source_node_id, target_node_id, source/target_handle, label, style) |
| `drawings` | `workspaces/{wsId}/drawings/{drawingId}` | Freehand drawing overlays (id, paths) |
| `snapshots` | `workspaces/{wsId}/snapshots/{snapId}` | Version history snapshots (name, nodes_data, edges_data, created_at) |
| `presence` | `workspaces/{wsId}/presence/{userId}` | Real-time cursor positions (x, y, name, color, last_seen) |
| `workspace_shares` | `workspace_shares/{shareId}` | Workspace sharing records |

### Firestore Security Rules (`firestore.rules`)

- **Admin**: `isAdmin()` checks `request.auth.token.email == 'mm.adnanakib@gmail.com'`.
- **Users**: Read allowed for any authenticated user; write only by owner or admin.
- **Workspaces**: Read if public, owner, shared-with-me, or admin. Create requires owner assignment. Update/delete by owner or admin.
- **Subcollections** (nodes/edges/drawings/snapshots): Inherit parent workspace permissions.
- **Sharing**: `workspace_shares` readable by sharer, recipient, or admin. Create/update/delete by workspace owner.

### CRUD Operations (`src/lib/firebase/canvasData.ts`)

- **Nodes**: `loadCanvasNodes`, `saveNode`, `deleteCanvasNode`, `updateNodePosition`, `updateNodeDataInDb`, `updateNodeStyle`.
- **Edges**: `loadCanvasEdges`, `saveEdge`, `deleteCanvasEdge`, `updateEdgeDataInDb`.
- **Drawings**: `loadCanvasDrawings`, `saveDrawing`, `deleteDrawingFromDb`.
- **Snapshots**: `createSnapshot`, `getSnapshots`, `deleteSnapshot`, `pruneSnapshots` (keeps last 50).
- **Presence**: `updateCursorPositionInDb`, `subscribeCursors`.
- **Real-time**: `subscribeCanvasNodes`, `subscribeCanvasEdges` use Firestore `onSnapshot`. Pending local writes are skipped via `snapshot.metadata.hasPendingWrites`.
- **Sanitization**: `sanitizeForFirestore()` recursively removes functions, symbols, non-POJO constructors, nested arrays (JSON-stringified), and prototype pollution keys (`__proto__`, `constructor`, `prototype`).

### Workspace Management (`src/lib/firebase/workspaces.ts`)

- **CRUD**: `getWorkspaces`, `createWorkspace`, `updateWorkspace`.
- **Soft delete**: `deleteWorkspace` sets `is_deleted: true`, `deleted_at` timestamp.
- **Restore**: `restoreWorkspace` reverses soft delete.
- **Permanent delete**: `permanentlyDeleteWorkspace` deletes subcollection docs then the workspace doc.
- **Empty trash**: `emptyTrash` permanently deletes all soft-deleted workspaces for current user.
- **Branch**: `branchWorkspace` copies all nodes/edges from source to a new workspace with `parent_workspace_id` set.
- **Duplicate**: `duplicateWorkspace` copies nodes/edges with new IDs, preserving tags/folder.
- **Merge back**: `mergeWorkspaceBack` replaces parent's nodes/edges with branch's content.

### User Settings (`src/lib/firebase/settings.ts`)

- Stored in `users/{uid}/settings` field (not a subcollection).
- Schema: `UserSettings` with `hotkeys`, `theme` (light/dark/system), `canvasTheme`, `enableHybridEditor`.
- `settingsStore.ts` uses Zustand `persist` middleware for localStorage + Firestore sync with 1s debounced writes.

### IndexedDB Cache Layer (`src/lib/cache/indexedDB.ts`)

- Database: `crxnote-cache`, version 2.
- Object stores: `canvas-nodes`, `canvas-edges`, `canvas-drawings`, `workspaces`, `node-counts`, `pending-ops`, `file-blobs`.
- Each entry is wrapped as `CachedEntry<T>` with `{ data, cachedAt }`.
- **File blob caching**: `cacheFileBlob`/`getFileBlob`/`removeFileBlob` for offline media viewing. Auto-cleanup after 7 days via `cleanupOldFileBlobs`.
- **Quota handling**: On `QuotaExceededError`, `purgeOldCaches()` clears non-critical stores but preserves `pending-ops`.
- **Log prefix**: All IndexedDB errors logged with `[DB]` prefix.

### Write-Through Cache & Offline Queue (`src/lib/cache/canvasCache.ts`)

Every write follows this pattern:
1. **Update IndexedDB immediately** — local state reflects the change instantly.
2. **Attempt Firestore write** — wrapped in `withRetry()` (3 attempts, exponential backoff).
3. **On failure** — queue as `PendingOp` via `addPendingOp()` to IndexedDB `pending-ops` store.

**PendingOp types**: `saveNode`, `saveEdge`, `deleteNode`, `deleteEdge`, `updatePosition`, `updateData`, `updateStyle`, `updateEdgeData`, `updateSettings`, `cacheFileBlob`, `removeFileBlob`, `saveDrawing`, `deleteDrawing`.

**Read path** (SWR pattern):
- `cachedLoadCanvasNodes/Edges/Drawings` returns `{ cached, fresh }`.
- `cached` is IndexedDB data with pending ops merged on top.
- `fresh` is a Firestore fetch that updates cache and triggers `onUpdate` callback if data changed.
- Workspaces use a 30-second TTL (`SWR_TTL`) — cached data returned if fresher than 30s.

**Validation before replay** (`validateAndFilterOps`):
- Identifies all pending delete operations.
- Filters out ops that reference deleted nodes/edges (prevents writing to non-existent docs).
- Filters out orphaned edges whose source or target node was deleted.

### Sync Manager (`startSyncManager` / `stopSyncManager`)

- Started once at app level via `useSyncManager` hook.
- **Initial replay**: 3s after startup (lets auth initialize).
- **Periodic retry**: Scheduled with exponential backoff, starting at 5s, capped at 60s.
- **Online event**: Triggers replay after 2s delay (lets network stabilize).
- **Offline event**: Cancels scheduled retry.
- **Replay safety**: 60s safety timeout, generation counter to abort stale replays.

**Conflict resolution during replay**:
- Stale ops (>30 days) are purged with a warning toast.
- Permanently failed ops (e.g., `invalid-argument`) are removed.
- Transient errors (network, auth, `unavailable`, `deadline-exceeded`) break the loop for retry.
- Unknown errors remove the op with a warning.

**Auth-aware retry** (`withRetry`):
- Detects JWT/auth errors via `isAuthError()`.
- Calls `ensureSession()` to force-refresh the Firebase ID token.
- 3 attempts with exponential backoff (500ms, 1s, 2s).

### Network Status

- `useNetworkStatus()` hook uses `useSyncExternalStore` with `navigator.onLine` and `online`/`offline` events.
- `usePendingOpsCount()` polls `getAllPendingOps()` every 5s and listens for `pending-ops-changed` custom events.

### Data Sanitization

Before writing to Firestore:
- `sanitizeForFirestore()` removes: functions, symbols, non-POJO objects, nested arrays (JSON-stringified), prototype pollution keys.
- `updateNodeData()` in canvasStore filters out `null`/`undefined` values.
- Edge IDs are validated against UUID regex — non-UUID edges are regenerated or skipped.
