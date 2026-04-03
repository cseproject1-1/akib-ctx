# CtxNote — Comprehensive Fix Plan (159 Bugs)

> **Generated:** April 2, 2026
> **Total Bugs:** 159 (24 Critical, 57 High, 62 Medium, 53 Low)
> **Strategy:** Fix in priority order. Critical/Security first, then core functionality, then reliability/UX.

---

## Execution Strategy

1. **Phase 1 — Security & Data Integrity** (Week 1): 24 Critical + priority High
2. **Phase 2 — Core Functionality** (Week 2): Remaining High + priority Medium
3. **Phase 3 — Reliability & UX** (Week 3): Remaining Medium + Low
4. **Phase 4 — Cleanup & Tests** (Week 4): Dead code, unused imports, test coverage

**Rules:**
- Run `npm run lint` and `npm run test` after every batch of changes
- Never break existing working features — prefer additive fixes over rewrites
- Add `isFinite()` guards everywhere NaN is possible
- Use try/catch on all async operations
- Keep changes minimal and focused

---

## PHASE 1: SECURITY & DATA INTEGRITY

### 1.1 — R2 Credentials Removal [B2]

**File:** `src/lib/r2/client.ts`
**Problem:** `VITE_R2_ACCESS_KEY_ID` and `VITE_R2_SECRET_ACCESS_KEY` are inlined into client bundle by Vite.
**Fix:**
- Remove the R2 client file entirely from client-side code
- Replace all client-side R2 operations with Worker API calls
- Create Worker endpoints: `POST /api/upload`, `DELETE /api/file`, `GET /api/file-url`
- Worker generates presigned URLs server-side, client uploads directly to R2 via presigned URL
- Update `r2/storage.ts` to call Worker instead of direct S3

**Affected files:**
- `src/lib/r2/client.ts` — DELETE
- `src/lib/r2/storage.ts` — Rewrite to use Worker API
- `worker/src/index.ts` — Add presigned URL endpoints

---

### 1.2 — Worker Authentication [B4]

**File:** `worker/src/index.ts`
**Problem:** No endpoint validates caller identity.
**Fix:**
- Create middleware function `verifyFirebaseToken(request)`:
  - Extract `Authorization: Bearer <token>` header
  - Verify with Firebase Admin SDK or REST `https://identitytoolkit.googleapis.com/v1/accounts:lookup`
  - Cache verified tokens for 5 minutes to avoid rate limits
- Apply to all 3 existing endpoints + new R2 endpoints
- Return 401 on missing/invalid token

**Affected files:**
- `worker/src/index.ts` — Add middleware, wrap all handlers

---

### 1.3 — SSRF Prevention [B1]

**File:** `worker/src/index.ts:24`
**Problem:** `/api/urlMetadata` fetches any URL server-side.
**Fix:**
- Parse URL, reject non-https schemes
- Reject known private IP ranges: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`, `127.x.x.x`, `169.254.x.x`, `::1`, `localhost`
- DNS resolve hostname first, check resolved IP is not private
- Add timeout (10s max)
- Add response size limit (1MB)

```ts
function isPrivateIP(hostname: string): boolean {
  // Resolve DNS, check ranges
  const privateRanges = [
    /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
    /^127\./, /^169\.254\./, /^localhost$/i, /^::1$/
  ];
  return privateRanges.some(r => r.test(hostname));
}
```

---

### 1.4 — Gemini API Key Header [B3]

**File:** `worker/src/index.ts:66`
**Problem:** API key in query string visible in logs.
**Fix:**
```ts
// Change from:
const url = `https://generativelanguage.googleapis.com/v1beta/models/...?key=${GEMINI_KEY}`;
// To:
headers: { 'x-goog-api-key': GEMINI_KEY }
```

---

### 1.5 — CORS Restriction [B8]

**File:** `worker/src/index.ts:10`
**Fix:**
```ts
const allowedOrigins = [
  'https://ctxnote.app',
  'http://localhost:8080',
  'http://localhost:5173'
];
// In handler:
const origin = request.headers.get('Origin');
const corsOrigin = allowedOrigins.includes(origin ?? '') ? origin : '';
```

---

### 1.6 — Gemini Error Sanitization [B15, B16]

**File:** `worker/src/index.ts:75,82`
**Fix:**
- Remove `details` from error responses
- Wrap JSON.parse in try/catch, return generic "AI returned invalid response" message
- Never expose raw API errors or keys to client

---

### 1.7 — Password Hash Exposure [B6]

**Files:** `src/lib/firebase/workspaces.ts:56`, `src/components/Dashboard.tsx:435`
**Fix:**
- Create Worker endpoint `POST /api/verify-workspace-password` that checks hash server-side
- Client sends password, receives boolean
- Remove `password_hash` from client-readable workspace docs (update Firestore rules)
- Or: keep hash readable but never expose in UI — add `password_hash` to Firestore rules deny list for reads

---

### 1.8 — Firestore Rules Fix [B7, B39, B25]

**File:** `firestore.rules`
**Changes:**
```
// Users collection — restrict to own doc
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && (request.auth.uid == userId || isAdmin());
}

// Presence — scope writes to own user ID
match /workspaces/{wsId}/presence/{userId} {
  allow read: if isWorkspaceMember(wsId);
  allow write: if isWorkspaceMember(wsId) && request.auth.uid == userId;
}
```

---

### 1.9 — new Function() Replacement [N1, N63]

**Files:** `src/components/nodes/TableNode.tsx:72`, `src/components/nodes/SpreadsheetNode.tsx:96`
**Fix:**
- Install `mathjs` or `expr-eval`
- Replace `new Function('return ' + expr)` with safe parser:
```ts
import { evaluate } from 'mathjs';
// or import { Parser } from 'expr-eval';
const result = evaluate(sanitizedExpression, cellValues);
```
- Validate expression against allowed operations before evaluation

---

### 1.10 — EmbedNode Sandbox [N2]

**File:** `src/components/nodes/EmbedNode.tsx:319`
**Fix:**
```ts
// Change from:
sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
// To:
sandbox="allow-scripts allow-forms allow-popups"
// If same-origin needed for specific embeds, add allow-same-origin ONLY for trusted domains
```

---

### 1.11 — PresentationMode XSS [A1]

**File:** `src/components/PresentationMode.tsx:415`
**Fix:**
```ts
import DOMPurify from 'dompurify';

const sanitizedHref = DOMPurify.sanitize(href, {
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
});
// Reject javascript:, data:, vbscript: URIs explicitly
```

---

### 1.12 — dangerouslySetInnerHTML [N3]

**File:** `src/components/nodes/CodeSnippetNode.tsx:171`
**Fix:**
```ts
import DOMPurify from 'domdompurify';
const cleanHtml = DOMPurify.sanitize(highlightedCode);
```

---

### 1.13 — Missing Firestore Index [B5]

**File:** `firestore.indexes.json`
**Fix:** Add composite index:
```json
{
  "collectionGroup": "workspaces",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "user_id", "order": "ASCENDING" },
    { "fieldPath": "is_deleted", "order": "ASCENDING" }
  ]
}
```

---

## PHASE 2: CORE FUNCTIONALITY

### 2.1 — Migration Type Fixes [M1, M4, M5, M9]

**File:** `src/lib/editor/migration.ts`

**M1 — Toggle types (lines 707-708):**
```ts
// Change:
type: 'summary'  →  type: 'detailsSummary'
type: 'paragraph'  →  type: 'detailsContent'
```

**M4 — Video/Audio types (line 674):**
```ts
// Change:
type: 'video'  →  type: 'videoBlock'
type: 'audio'  →  type: 'audioBlock'
```

**M5 — List wrapping (lines 560-571):**
```ts
// Before pushing listItem to doc, group consecutive items:
function wrapListItems(items: BlockNoteBlock[], listType: 'bulletList' | 'orderedList') {
  return { type: listType, content: items };
}
// Scan for consecutive listItems and wrap them
```

**M9 — Nested list children (line 563):**
```ts
// Wrap nested children in a sub-list container:
if (node.children?.length) {
  const childListItems = node.children.map(convertToTipTap);
  block.content.push({
    type: node.type === 'bulletListItem' ? 'bulletList' : 'orderedList',
    content: childListItems
  });
}
```

---

### 2.2 — Migration Feature Preservation [M3, M7, M8, M12, M14, M16-M20]

**File:** `src/lib/editor/migration.ts`

| Bug | Fix |
|-----|-----|
| M3 (Callout) | Create custom BlockNote callout spec preserving type/color/icon/collapsed in props |
| M7 (Wiki-link) | Store `nodeId` in BN props: `{ nodeId: linkNodeId, label: text }` |
| M8 (Math) | Store LaTeX in BN block props: `{ latex: formula }` |
| M12 (Columns) | Create custom `columnLayout` BN spec wrapping children |
| M14 (Heading levels) | Store level in props: `{ level: originalLevel }`, render with tag |
| M16 (Inline images) | Create BN image inline spec with `src`/`alt` props |
| M17 (Mentions) | Create BN mention inline spec storing userId/link |
| M18 (Files) | Create BN file spec with metadata props |
| M19 (Mermaid) | Create BN mermaid spec with diagram type prop |
| M20 (Tables) | Store `columnCount` in table block props |

---

### 2.3 — EditorGhost BlockNote Support [M6]

**File:** `src/components/EditorGhost.tsx`
**Fix:**
- Add BlockNote format detection alongside TipTap
- For BN blocks: check `block.props.textColor`, `block.props.backgroundColor`
- For BN inline: check `content.styles` instead of `marks`

---

### 2.4 — AI Endpoint Fix [B14]

**File:** `src/lib/ai/aiService.ts`
**Problem:** Calls `/api/chat` but Worker only has `/api/aiStudy` + `/api/scrape`.
**Fix:**
- Option A: Add `/api/chat` endpoint in Worker that mirrors `/api/aiStudy`
- Option B: Change `aiService.ts` to call existing endpoints
- Choose Option A for minimal client changes

---

### 2.5 — R2 Deletion Prefix Fix [B9]

**File:** `src/lib/r2/storage.ts:155`
**Fix:**
```ts
// Change from:
const prefix = `workspaces/${workspaceId}/`;
// To:
const prefix = `${userId}/${workspaceId}/`;
// Add userId parameter to deleteWorkspaceFiles function
```

---

### 2.6 — Workspace Access Control [W1, B17]

**File:** `src/components/ViewWorkspacePage.tsx:25-35`
**Fix:**
```ts
const workspace = await getWorkspace(workspaceId);
if (!workspace.is_public && workspace.user_id !== auth.currentUser?.uid) {
  // Check workspace_shares for this user
  const share = await getShareForUser(workspaceId, auth.currentUser?.uid);
  if (!share) {
    navigate('/404');
    return;
  }
}
```

---

### 2.7 — resetState Completeness [W3, B40]

**File:** `src/store/canvasStore.ts:1002-1017`
**Fix:** Add all workspace-scoped fields:
```ts
resetState: () => {
  const defaultState = getDefaultState();
  set({
    ...defaultState,
    // Ensure ALL these fields are reset:
    nodes: [],
    edges: [],
    selectedNodeIds: [],
    contextMenu: null,
    cursors: {},
    backlinks: {},
    zenMode: false,
    drawingMode: false,
    allLocked: false,
    connectMode: false,
    clipboard: null,
    undoStack: [],
    redoStack: [],
    _skipSync: false,
    _skipSyncTimeout: null, // Also clear timeout first (B22)
    // ... all other workspace-scoped fields
  });
}
```

Also fix B22 — call `clearTimeout(get()._skipSyncTimeout)` before nulling.

---

### 2.8 — hasPendingWrites Fix [W4]

**File:** `src/lib/firebase/canvasData.ts:222-238`
**Fix:**
```ts
// Instead of skipping entire snapshot:
if (snapshot.metadata.hasPendingWrites) return; // WRONG

// Process each doc, skip only pending ones:
snapshot.docChanges().forEach(change => {
  if (change.doc.metadata.hasPendingWrites) return; // Skip only this doc
  // Process non-pending changes...
});
```

---

### 2.9 — Merge Safety [W5]

**File:** `src/lib/firebase/workspaces.ts:277-314`
**Fix:**
- Use Firestore `writeBatch` for atomicity
- First delete, then copy, all in one batch
- Add try/catch with rollback on failure
- Limit batch to 500 operations (Firestore limit), chunk if needed

---

### 2.10 — Subcollection Cleanup [B10, W8]

**File:** `src/lib/firebase/workspaces.ts:95-108`
**Fix:**
```ts
async function cleanSubcollections(wsId: string) {
  const subcollections = ['nodes', 'edges', 'drawings', 'snapshots', 'presence'];
  for (const col of subcollections) {
    const docs = await getDocs(collection(db, 'workspaces', wsId, col));
    const batch = writeBatch(db);
    docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}
```

---

### 2.11 — Ownership Checks [B11, B12, B13, W14]

**Files:** `src/lib/firebase/workspaces.ts`

**B11 — updateWorkspace:**
```ts
const wsDoc = await getDoc(doc(db, 'workspaces', wsId));
if (wsDoc.data()?.user_id !== auth.currentUser?.uid && !isAdmin()) {
  throw new Error('Unauthorized');
}
```

**B12 — mergeWorkspaceBack:**
```ts
// Verify both branch and parent belong to current user
```

**B13 — branchWorkspace:**
```ts
// Check source workspace is public OR belongs to current user
```

**W14 — mergeWorkspaceBack auth:**
```ts
if (!auth.currentUser) throw new Error('Not authenticated');
```

---

### 2.12 — Alt+Drag Undo [W2, U1]

**File:** `src/components/CanvasWrapper.tsx:843-867`
**Fix:**
```ts
// After cloning node, also register with undo system:
const clonedNode = { ...originalNode, id: newId, position: newPos };
get().addNode(clonedNode); // This goes through proper store method with undo
// Then mark as selected for drag
```

---

### 2.13 — Workspace Filtering [W6, W7]

**W6 — `src/lib/firebase/workspaces.ts:24-35`:**
```ts
const q = query(
  collection(db, 'workspaces'),
  where('user_id', '==', userId),
  where('is_deleted', '==', false)  // ADD THIS
);
```

**W7 — `src/components/WorkspaceSwitcher.tsx:27`:**
```ts
// If backend can't be changed, filter client-side:
const activeWorkspaces = workspaces.filter(w => !w.is_deleted && !w.is_in_vault);
```

---

### 2.14 — Promise.all Batching [W10]

**File:** `src/lib/firebase/workspaces.ts:191,260`
**Fix:**
```ts
// Use existing chunkArray helper:
const chunks = chunkArray(allDocs, 400); // Firestore batch limit is 500
for (const chunk of chunks) {
  const batch = writeBatch(db);
  chunk.forEach(({ ref, data }) => batch.set(ref, data));
  await batch.commit();
}
```

---

### 2.15 — Version Restore Safety [W11]

**File:** `src/components/VersionHistoryPanel.tsx:64-68`
**Fix:**
```ts
// Save current state as snapshot before restoring:
await createSnapshot(workspaceId, 'Pre-restore backup', currentNodes, currentEdges, currentDrawings);
// Then restore
```

---

### 2.16 — HistoryPanel Flood Fix [W12]

**File:** `src/components/HistoryPanel.tsx:19-21`
**Fix:**
```ts
// Use loadCanvas with skipSync flag instead of individual setNodes:
await loadCanvas(nodes, edges, true); // skipSync = true
```

---

### 2.17 — Merge Drawings [W13]

**File:** `src/lib/firebase/workspaces.ts:265-314`
**Fix:** Add drawing copy logic alongside nodes/edges:
```ts
const drawings = await loadCanvasDrawings(branchId);
for (const drawing of drawings) {
  await saveDrawing(parentId, { ...drawing, id: crypto.randomUUID() });
}
```

---

### 2.18 — DatabaseNode ID Collision [N4]

**File:** `src/components/nodes/DatabaseNode.tsx:112`
**Fix:**
```ts
// Change from:
const newId = `col_${Date.now()}`;
// To:
const newId = `col_${crypto.randomUUID()}`;
```

---

### 2.19 — Duplicate BatchToolbar [U6]

**Files:** `src/components/SelectionToolbar.tsx:59`, `src/components/BatchToolbar.tsx:28`
**Fix:** When 2+ nodes selected, show only BatchToolbar:
```ts
// In SelectionToolbar:
if (selectedNodeIds.length >= 2) return null;
```

---

## PHASE 3: RELIABILITY & UX

### 3.1 — BaseNode Fixes [N6, N7, N8, N9, N24, N25, N46, N61]

**File:** `src/components/nodes/BaseNode.tsx`

| Bug | Fix |
|-----|-----|
| N6 (overflow-hidden) | Remove `overflow-hidden`, use `overflow-auto` or clip only specific child |
| N7 (resize wrong ID) | Use `nodeId` prop (with useNodeId fallback) instead of `id` |
| N8 (full edges sub) | Filter edges: `useCanvasStore(s => s.edges.filter(e => e.source === nodeId \|\| e.target === nodeId))` |
| N9 (animate-pulse) | Replace with static colored indicator (green dot for synced) |
| N24 (header overflow) | Wrap buttons in scrollable container with `overflow-x-auto` |
| N25 (timestamp) | Move timestamp inside non-overflow container |
| N46 (edgeCount O(n)) | Precompute edge count map in store or memoize per node |
| N61 (duplicate tags) | Deduplicate tags: `[...new Set(tags)]` before rendering |

---

### 3.2 — Textarea Sync [N11, N16]

**Files:** `src/components/nodes/TextNode.tsx:49`, `src/components/nodes/CodeSnippetNode.tsx:122`
**Fix:**
```ts
// Switch from defaultValue to controlled value:
const [value, setValue] = useState(nodeData.text ?? '');
// Sync from external changes:
useEffect(() => { setValue(nodeData.text ?? ''); }, [nodeData.text]);
// Debounce store updates:
const debouncedUpdate = useMemo(() => debounce((v) => updateNodeData(id, { text: v }), 300), []);
```

---

### 3.3 — Stale Closures [N5, N13]

**N5 — DatabaseNode:**
```ts
// Use functional store updates instead of capturing stale values:
onChange={(rowId, colId, value) => {
  useCanvasStore.getState().updateNodeData(nodeId, (prev) => ({
    ...prev,
    rowsData: prev.rowsData.map(r => r.id === rowId ? { ...r, [colId]: value } : r)
  }));
}}
```

**N13 — ImageNode/PDFNode:**
```ts
// Add all dependencies to useCallback:
useCallback(handleDrop, [id, updateNodeData, nodeData]);
```

---

### 3.4 — AbortControllers [N18, N19]

**N18 — BookmarkNode:**
```ts
useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal })
    .then(...)
    .catch(e => { if (e.name !== 'AbortError') console.error(e); });
  return () => controller.abort();
}, [url]);
```

**N19 — EmbedNode:** Same pattern.

---

### 3.5 — Cursors Coordinate System [U5]

**File:** `src/components/MagicCursorsLayer.tsx:19-24`
**Fix:**
```ts
// Apply viewport transform to flow coordinates:
const screenPos = flowToScreenPosition({ x: cursor.x, y: cursor.y });
// Or store screen coordinates in presence data
```

---

### 3.6 — DrawingOverlay SVG [U4]

**File:** `src/components/DrawingOverlay.tsx:92-93`
**Fix:**
```ts
const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
useEffect(() => {
  const resizeObserver = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    setDimensions({ width, height });
  });
  resizeObserver.observe(document.body);
  return () => resizeObserver.disconnect();
}, []);
```

---

### 3.7 — Z-Index Standardization [U17]

Create a constants file or use consistently:
```ts
const Z_INDEX = {
  canvas: 0,
  nodes: 10,
  contextMenu: 50,
  toolbar: 60,
  modal: 70,
  vaultModal: 80,
  nodeExpandModal: 90,
  presentation: 100,
  toast: 110,
} as const;
```
Apply across all files.

---

### 3.8 — EdgeContextMenu AnimatePresence [U3]

**File:** `src/components/EdgeContextMenu.tsx:107-201`
**Fix:** Wrap both backdrop and menu in single AnimatePresence:
```tsx
<AnimatePresence>
  {isOpen && (
    <>
      <motion.div className="backdrop" ... />
      <motion.div className="menu" ... />
    </>
  )}
</AnimatePresence>
```

---

### 3.9 — Batch Delete Undo [U13]

**File:** `src/components/BatchToolbar.tsx:37-41`
**Fix:**
```ts
const handleDelete = () => {
  pushSnapshot(); // Save current state for undo
  selectedNodeIds.forEach(id => deleteNode(id));
};
```

---

### 3.10 — Double Store Update [U10]

**File:** `src/components/CanvasWrapper.tsx:275,427`
**Fix:** Add flag:
```ts
const [isDragging, setIsDragging] = useState(false);

// In handleNodesChange:
if (isDragging) return; // Skip during drag

// In handleNodeDragStop:
setIsDragging(false);
// Update store once here
```

---

### 3.11 — Collision Repulsion Sync [U2]

**File:** `src/components/CanvasWrapper.tsx:392-416`
**Fix:** After computing repulsed positions, also sync to store:
```ts
const repulsedNodes = applyRepulsion(localNodes, draggedNode);
setLocalNodes(repulsedNodes);
debouncedSyncToStore(repulsedNodes); // ADD THIS
```

---

### 3.12 — CustomEdge Picker Bounds [U9]

**File:** `src/components/CustomEdge.tsx:510,594`
**Fix:** Add viewport clamping:
```ts
const clampedX = Math.max(10, Math.min(x, window.innerWidth - pickerWidth - 10));
const clampedY = Math.max(10, Math.min(y, window.innerHeight - pickerHeight - 10));
```

---

### 3.13 — NodeContextMenu Submenu [U12]

**File:** `src/components/NodeContextMenu.tsx:103-105`
**Fix:**
```ts
const flippedLeft = Math.max(0, left - submenuWidth);
```

---

### 3.14 — CanvasToolbar Popovers [U7]

**File:** `src/components/CanvasToolbar.tsx:567-668`
**Fix:** Add `max-h-[80vh] overflow-y-auto` to popover containers.

---

### 3.15 — Escape Shortcut Conflict [U11]

**File:** `src/components/CanvasToolbar.tsx:112-122`
**Fix:**
```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // Check if any modal/dialog is open first
    if (document.querySelector('[role="dialog"]')) return;
    // Then handle toolbar
    closeMenus();
  };
}, []);
```

---

### 3.16 — FlashcardNode Guard [N20]

**File:** `src/components/nodes/FlashcardNode.tsx:32`
**Fix:**
```ts
const nextCard = () => {
  if (totalCards === 0) return;
  setCurrentIndex(i => Math.min(i + 1, totalCards - 1));
};
const prevCard = () => {
  if (totalCards === 0) return;
  setCurrentIndex(i => Math.max(i - 1, 0));
};
```

---

### 3.17 — signOut Error Handling [B20]

**File:** `src/contexts/AuthContext.tsx:114-118`
**Fix:**
```ts
const signOut = async () => {
  try {
    await clearAllCaches();
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('[Auth] Sign out failed:', error);
    toast.error('Failed to sign out. Please try again.');
  }
};
```

---

### 3.18 — ImportPage URL Sanitization [B18]

**File:** `src/components/ImportPage.tsx:20-47`
**Fix:**
```ts
const urlParam = searchParams.get('url');
if (urlParam) {
  try {
    const parsed = new URL(urlParam);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    setUrl(parsed.href);
  } catch {
    setUrl('');
  }
}
```

---

### 3.19 — Settings Store Timer Conflict [W18]

**File:** `src/store/settingsStore.ts:68-128`
**Fix:** Use separate timers per setting group:
```ts
const _hotkeysTimer = { current: null };
const _themeTimer = { current: null };
const _canvasTimer = { current: null };
const _editorTimer = { current: null };
```

---

### 3.20 — Auto-Save Excludes Drawings [W15]

**File:** `src/components/WorkspacePage.tsx:617`
**Fix:**
```ts
await createSnapshot(workspaceId, name, nodes, edges, drawings); // Add drawings param
```

---

### 3.21 — Branch Workspace Default Fields [W16]

**File:** `src/lib/firebase/workspaces.ts:138-148`
**Fix:** Add defaults matching `createWorkspace`:
```ts
const newWorkspace = {
  ...branchData,
  is_deleted: false,
  tags: source.tags ?? [],
  folder: source.folder ?? null,
  is_in_vault: false,
  is_password_protected: false,
  password_hash: null,
  parent_workspace_id: sourceId,
  created_at: serverTimestamp(),
  updated_at: serverTimestamp(),
};
```

---

### 3.22 — LinkPeekCard Error Handling [U30, U31]

**File:** `src/components/LinkPeekCard.tsx`

**U30:**
```ts
try {
  const url = new URL(href);
} catch {
  return <InvalidUrlState />;
}
```

**U31:**
```ts
fetch(url)
  .then(...)
  .catch(err => {
    setError(err.message);
    setLoading(false);
  });
```

---

### 3.23 — autoFocus Fixes [N34, N35, N37]

**Files:** EmbedNode, VideoNode, KanbanNode
**Fix:** Remove `autoFocus` from inputs, or delay:
```ts
useEffect(() => {
  if (isSelected) {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }
}, [isSelected]);
```

---

### 3.24 — ChecklistNode Performance [N49]

**File:** `src/components/nodes/ChecklistNode.tsx:61-69`
**Fix:** Throttle dragover handler:
```ts
const throttledDragOver = useMemo(
  () => throttle(handleDragOver, 100),
  [handleDragOver]
);
```

---

### 3.25 — TableNode Blob URL Leak [N22]

**File:** `src/components/nodes/TableNode.tsx:57-64`
**Fix:**
```ts
const handleExport = () => {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'table.csv';
  a.click();
  URL.revokeObjectURL(url); // ADD THIS
};
```

---

### 3.26 — Remaining Node Fixes [Various]

| Bug | File | Fix |
|-----|------|-----|
| N21 | ChecklistNode | Wrap mutators in `useCallback` |
| N23 | TableNode | Implement Excel-style column naming (A-Z, AA-AZ...) |
| N26 | TextNode | Remove duplicate selection border |
| N27 | TextNode | Allow double-click to select+edit |
| N28 | AINoteNode | Store `previousHeight` in nodeData, not ref |
| N29 | AINoteNode | Replace `as any` casts with proper types |
| N30 | DatabaseNode | Remove unused `GroupNodeData` import |
| N31 | DatabaseNode | Change `bg-black/20` to `bg-muted` |
| N32 | KanbanNode | Validate local state against store on render |
| N38 | MathNode | Add `viewMode` to ref dependencies |
| N40 | CodeSnippetNode | Add `touchstart` alongside `mousedown` |
| N41 | DrawingNode | Change to `preserveAspectRatio="xMidYMid meet"` |
| N42 | DrawingNode | Generate unique IDs for path keys |
| N43 | DrawingNode | Use `Math.sqrt(scaleX * scaleY)` |
| N51 | KanbanNode | Use responsive min-width |
| N55 | CodeSnippetNode | Support configurable indent, add Shift+Tab |
| N56 | MathNode | Use deterministic placeholder |
| N58 | DrawingNode | Only set original dims if `!originalWidth` |
| N59 | FlashcardNode | Add `animation-fill-mode: forwards` |
| N60 | FlashcardNode | Already confirmed working — no fix needed |

---

### 3.27 — Remaining Canvas/UI Fixes [Various]

| Bug | File | Fix |
|-----|------|-----|
| U14 | useAlignmentGuides | DELETE file (dead code) |
| U15 | ViewCanvasWrapper | Set `nodesDraggable={isEditMode}` globally |
| U16 | ViewCanvasWrapper | Add onEdgesChange handler |
| U18 | FileAttachmentNode | Use counter-based dragleave (increment on dragenter, decrement on dragleave) |
| U19 | NodeExpandModal | Add null check: `expandedNodeRef.current?.scrollIntoView?.()` |
| U20 | DrawingOverlay | Add viewport boundary clamping for context menu |
| U21 | CanvasWrapper | Remove duplicate React import |
| U22 | CanvasWrapper | Remove unused `drawColor`/`drawWidth` |
| U24 | EdgeContextMenu | Remove unused imports |
| U25 | NodeContextMenu | Add `document.execCommand('copy')` fallback |
| U26 | MagicCursorsLayer | Use `auth.currentUser?.uid` instead of `'local'` |
| U27 | NodeContextMenu | Use `node.measured` dimensions |
| U30 | LinkPeekCard | Wrap `new URL()` in try-catch |
| U31 | LinkPeekCard | Add `.catch()` to fetch |
| U32 | HotkeySettingsModal | Check `e.target` is not input/textarea before `preventDefault` |

---

### 3.28 — Remaining Backend Fixes [Various]

| Bug | File | Fix |
|-----|------|-----|
| B26 | r2/storage.ts | Add `if (file.size > 50 * 1024 * 1024) throw` |
| B27 | r2/storage.ts | Validate MIME type against allowlist |
| B28 | useAdminData.ts:88 | Query nodes collection count per workspace |
| B29 | useAdminData.ts:120 | Query workspaces grouped by user_id |
| B30 | useAdminData.ts:171 | Batch-fetch user docs for owner_name |
| B31 | useAdminData.ts:139 | Use `permanentlyDeleteWorkspace` |
| B32 | useAdminData.ts:236 | Fix field name to `user_id` |
| B33 | firestore.rules | Add specific subcollection rules |
| B34 | SignupPage.tsx:46 | Capture and display `error` from `sendVerification` |
| B36 | aiService.ts:1 | Remove unused `toast` import |
| B37 | r2/storage.ts:146 | Add `userId` param |
| B38 | dataconnect/schema | Remove or replace with app schema |
| B41 | AuthContext.tsx:138 | Add `console.warn('HMR fallback signOut')` |
| B42 | WorkspacePage.tsx:369 | Rename shadowing `prev` variables |
| B43 | canvasData.ts:111 | Remove unused `UUID_LENIENT_RE` |

---

### 3.29 — Remaining Workspace Fixes [Various]

| Bug | File | Fix |
|-----|------|-----|
| W9 | useAdminData.ts:139 | Use `permanentlyDeleteWorkspace` for admin deletion |
| W17 | Dashboard.tsx:355 | Search both `workspaces` and `vaultWorkspaces` arrays |
| W19 | workspaces.ts:121 | Use `writeBatch` for `emptyTrash` |
| W20 | WorkspacePage.tsx:202 | Use `useVaultStore(s => s.isLocked)` hook selector |
| W21 | canvasStore.ts:425 | Clone connected edges when duplicating node |
| W22 | ShareWorkspaceModal.tsx:67 | Check permissions in ViewWorkspacePage |
| W23 | canvasData.ts:230 | Add `isFinite()` guards |
| W24 | useAdminData.ts:88 | Same as B28 |
| W25 | WorkspacePage.tsx:91 | Use `preserveHistory: true` consistently |
| W26 | useAdminData.ts:120 | Same as B29 |
| W27 | workspaces.ts:206 | Add `is_in_vault`, `is_password_protected` to duplicate |
| W28 | canvasData.ts:203 | Use `limit(51)` query, delete oldest if >50 |

---

### 3.30 — Remaining Migration Fixes [Various]

| Bug | File | Fix |
|-----|------|-----|
| M2 | migration.ts:300 | Handle `detailsContent` wrapper explicitly |
| M10 | BlockNoteEditor.tsx:166 | Reset `initialContentApplied` ref when `initialContent` prop changes |
| M13 | migration.ts:14-23 | Add explicit `version` field to content schema |
| M21 | CustomBlockExtensions | Add migration handlers for progressBar, badge, bookmark, footnoteRef, footnoteItem, caption |
| M22 | migration.ts:30-91 | Add validation layer that checks node schema before returning |
| M23 | migration.ts:143 | Validate `typeof checked === 'boolean'` before cast |
| M24 | migration.ts:685 | Add TipTap→BN reverse handler for files if custom extension exists |
| M26 | LectureNotesNode.tsx:80 | Make `forceTiptap` configurable via settings |
| M27 | migration.ts:50,86 | Store original content in `_backup` field on error |
| M28 | migration.ts:811 | Use `'inherit'` or proper CSS value instead of `'default'` |
| M30 | HybridEditor.tsx:107 | Add restore UI or remove `_v1Backup` code |
| M31 | NoteEditor.tsx:67 | Add `console.warn('Extension failed to load:', name, err)` |
| M32 | migration.test.ts | Add test cases for toggle, callout, nested lists, wiki-links, math, video/audio, columns |
| M33 | migration.ts:757 | Check `tableHead` only in first row |
| M34 | migration.ts:108 | Extend TipTap TextAlign config to more block types |
| M35 | ViewWorkspacePage.tsx:69 | Add `isFinite()` guards |
| M36 | Use controlled value | ShapeNode.tsx:70 |

---

### 3.31 — Remaining Additional UI Fixes [Various]

| Bug | File | Fix |
|-----|------|-----|
| A2 | EditorGhost.tsx:124 | Add DOMPurify for defense-in-depth |
| A4 | DailyLogNode.tsx:72 | Add `e.stopPropagation()` to buttons |
| A6 | SpreadsheetNode.tsx:87 | Add range expander for `SUM(A1:B2)` |
| A7 | SpreadsheetNode.tsx:174 | Use proper CSV parser or fix regex |
| A8 | ImportModal.tsx:114 | Use ref to prevent duplicate import |
| A9 | ThemeEditor.tsx:122 | Pass specific style value to `setGridStyle` |
| A10 | NodeExpandModal.tsx:562 | Remove bare `F` shortcut |
| A11 | LectureNotesNode.tsx:34 | Scope selector to needed nodes only |
| A13 | TemplateGallery.tsx:62 | Change to `z-[100]` |
| A12 | VersionHistoryPanel.tsx:83 | Add backdrop and `overflow: hidden` on body |
| A14 | VaultModal.tsx:448 | Add body scroll lock on mount/unmount |
| A15 | ShortcutsDialog.tsx:89 | Add onClick handler to reset button |

---

## PHASE 4: CLEANUP & TESTS

### 4.1 — Dead Code Removal

| Item | File |
|------|------|
| Unused `UUID_LENIENT_RE` | `canvasData.ts:111` |
| Unused `toast` import | `aiService.ts:1` |
| Unused `GroupNodeData` import | `DatabaseNode.tsx:15` |
| Unused `useAlignmentGuides` | `useAlignmentGuides.ts` (delete file) |
| Duplicate React import | `CanvasWrapper.tsx:1,67` |
| Unused `drawColor`/`drawWidth` | `CanvasWrapper.tsx:293-294` |
| Unused imports | `EdgeContextMenu.tsx:4` |
| `_v1Backup` dead code | `HybridEditor.tsx:107` |
| DataConnect boilerplate | `dataconnect/schema/schema.gql` (remove or replace) |

### 4.2 — Test Coverage Additions

**File:** `src/test/migration.test.ts`
Add tests for:
- Toggle block migration (M1)
- Callout block migration (M3)
- Nested list migration (M5, M9)
- Wiki-link preservation (M7)
- Math block migration (M8)
- Video/Audio type migration (M4)
- Column layout migration (M12)

**File:** `src/test/canvasStore.test.ts`
Add tests for:
- `resetState()` completeness (W3)
- Alt+Drag undo registration (W2)
- Duplicate node edge cloning (W21)

**File:** `src/lib/firebase/__tests__/workspaces.test.ts`
Add tests for:
- `emptyTrash` batching (W19)
- `mergeWorkspaceBack` drawings (W13)
- Branch default fields (W16)

---

## VERIFICATION CHECKLIST

After each batch of fixes:

- [ ] `npm run lint` — no new errors
- [ ] `npm run test` — all tests pass
- [ ] `npm run build` — builds successfully
- [ ] Manual test: open canvas, create nodes, drag, connect edges
- [ ] Manual test: create/delete/restore workspaces
- [ ] Manual test: BlockNote editor toggle/callout/list rendering
- [ ] Manual test: offline mode + reconnection sync
- [ ] Manual test: admin panel loads without errors

---

## FIX SUMMARY BY PHASE

| Phase | Critical | High | Medium | Low | Total |
|-------|----------|------|--------|-----|-------|
| 1 — Security | 14 | 8 | 2 | 0 | 24 |
| 2 — Core | 6 | 15 | 8 | 4 | 33 |
| 3 — Reliability | 4 | 30 | 45 | 45 | 124 |
| 4 — Cleanup | 0 | 4 | 7 | 4 | 15 |
| **TOTAL** | **24** | **57** | **62** | **53** | **159** |

---

## NOTES

- Some bugs overlap (e.g., B10/W8, B28/W24, B29/W26) — fix once, reference in both
- M32 is a test-only bug — add tests, no code changes needed
- B38 (DataConnect) is a removal task — verify no imports depend on it first
- N60 was already confirmed as working — no fix needed
