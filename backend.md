# Backend Documentation — CtxNote (Migrated to Firebase & R2)

> Updated on 2026-03-09. This application has been successfully migrated from Supabase to Firebase for Auth and Firestore, and Cloudflare R2 for file storage.

---

## 1. Overview

| Layer | Technology |
|---|---|
| Auth | Firebase Authentication |
| Database | Cloud Firestore (NoSQL, structured via subcollections) |
| File Storage | Cloudflare R2 via AWS SDK S3 integration |
| Serverless Functions | Firebase Cloud Functions (Callable via SDK) |
| Client SDK | `firebase` v10+, `@aws-sdk/client-s3` |

### Environment Variables (runtime)

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase config |
| `VITE_FIREBASE_PROJECT_ID` | Firebase config |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase config |
| `VITE_FIREBASE_APP_ID` | Firebase config |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase config |
| `VITE_R2_ACCOUNT_ID` | Cloudflare R2 config |
| `VITE_R2_ENDPOINT` | Cloudflare R2 config |
| `VITE_R2_ACCESS_KEY_ID` | Cloudflare R2 config |
| `VITE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 config |
| `VITE_R2_BUCKET_NAME` | Cloudflare R2 config |
| `VITE_R2_PUBLIC_URL` | Cloudflare R2 Custom Domain URL |

---

## 2. Database Structure (Firestore)

The Postgres tables were migrated to Firestore collections and subcollections.

### `workspaces` (Root Collection)
Documents represent workspaces.
- `id` (string)
- `name` (string)
- `color` (string)
- `user_id` (string - Firebase Auth UID)
- `owner_name` (string)
- `is_public` (boolean)
- `created_at`, `updated_at` (timestamps)

### Canvas Subcollections (Under `workspaces/{workspaceId}`)
- `nodes`: Individual canvas nodes. Contains `position_x`, `position_y`, `width`, `height`, `z_index`, `type`, and nested JSON `data`.
- `edges`: Connecting lines between nodes. Contains `source_node_id`, `target_node_id`, `label`, and nested `style`.
- `snapshots`: Version history snapshots with full graph exports.

### `workspace_shares` (Root Collection)
Documents containing sharing metadata.
- `workspace_id`
- `shared_by` (Firebase Auth UID)
- `shared_with_email`
- `permission` ('read' | 'edit')

---

## 3. Storage (Cloudflare R2)

Implemented using the `@aws-sdk/client-s3` library. R2 acts as an S3-compatible backend.

### Bucket configuration:
- Standard S3 `PutObjectCommand` and `DeleteObjectCommand` via R2 endpoints.
- Pre-signed URLs not strictly used for `PutObject` because uploads flow through the frontend AWS SDK client instance configured with the R2 access keys directly.
- Public URL format uses `VITE_R2_PUBLIC_URL + '/' + path`.

### Client API (`src/lib/r2/storage.ts`)
```typescript
uploadCanvasFile(workspaceId: string, file: File, onProgress?: (pct: number) => void): Promise<{ url: string; path: string }>
deleteCanvasFile(path: string): Promise<void>
compressImage(file: File, maxDimension?: number, quality?: number): Promise<File>
```

---

## 4. Client API Layer

Data interaction layer was fully rewritten.

- **Client setup:** `src/lib/firebase/client.ts` initializes App, Firestore, Auth, Functions.
- **R2 setup:** `src/lib/r2/client.ts` initializes S3Client for R2.
- **Workspaces:** `src/lib/firebase/workspaces.ts` (CRUD, Branching, Merging, Duplication).
- **Canvas graph:** `src/lib/firebase/canvasData.ts` (CRUD for node/edges subcollections, history snapshots).

---

## 5. Firebase Cloud Functions

Supabase Edge functions were migrated to Firebase Callable Cloud Functions.

- `urlMetadata`: Fetches OG tags and metadata for external URLs (used in EmbedNode).
- `aiStudy`: Calls external APIs to summarize selected node blocks or generate flashcards.
- `getSharedWorkspace`: Fetches workspace data securely if the workspace is set to `is_public` or if email matches.
- `adminData`/`hasRole`/`delete-user`/`delete-workspace`: Administrative endpoints to fetch site statistics and moderate content.

---

## 6. Migration Status (Completed)

1. **[x] Auth:** Switched to Firebase Authentication via `AuthContext.tsx`.
2. **[x] Database:** Data layer rewritten to Firestore collections/subcollections.
3. **[x] Client API:** `src/lib/supabase/*` removed, replaced by `src/lib/firebase/*`.
4. **[x] Storage:** Replaced with Cloudflare R2 implementation (`src/lib/r2/storage.ts`).
5. **[x] Server Functions:** Refactored into Firebase Functions (`httpsCallable`).
6. **[x] Client SDK:** Remvoed `@supabase/supabase-js`, using `firebase` npm package and `aws-sdk/client-s3`.
