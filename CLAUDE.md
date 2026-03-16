# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands
- **Run dev server**: `bun run dev` or `npm run dev` (Vite on port 8080)
- **Build**: `bun run build` or `npm run build`
- **Lint**: `bun run lint` or `npm run lint`
- **Test**: `bun run test` (Vitest)
- **Watch tests**: `bun run test:watch`
- **Firebase Deploy**: `firebase deploy` (Requires CLI)

## Architecture Overview
This is a non-linear knowledge base app (CtxNote) built with React, Vite, Tailwind CSS, and Firebase.

### Data & Sync Strategy
- **Backend**: Firebase Firestore for nodes, edges, and workspaces.
- **Local Persistence**: IndexedDB (via `src/lib/cache/indexedDB.ts`) used for caching server data and storing "Pending Operations" when offline.
- **Sync Manager**: `src/lib/cache/canvasCache.ts` handles the "Write-through" cache. It queues failed writes as `PendingOp` and replays them when back online.
- **State Management**: Zustand stores in `src/store/` (e.g., `canvasStore.ts` for the infinite canvas).
- **Infinite Canvas**: Powered by `@xyflow/react`.

### Core Directories
- `src/components/`: UI components (Shadcn + custom nodes).
- `src/lib/cache/`: Logic for IndexedDB and background syncing.
- `src/lib/firebase/`: Server-side data access logic.
- `src/store/`: Zustand stores for global state.
- `src/hooks/`: React hooks, including `useSyncManager.ts` for lifecycle sync.

### Offline & PWA
- Uses `vite-plugin-pwa` for service worker management.
- Static assets and some runtime assets (fonts, images) are cached.
- Canvas data is accessible offline via IndexedDB cache if previously loaded.
