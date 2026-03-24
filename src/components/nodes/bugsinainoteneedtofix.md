## Critical Bugs

### 1. **Node `createdAt` Not Preserved During Editor Migration**
- **Location**: `src/components/editor/HybridEditor.tsx` (lines 90-106)
- **Issue**: When migrating content between Tiptap (v1) and BlockNote (v2), the `handleContentChange` function only sets `blockVersion` but **never preserves or updates the `createdAt` field**.
- **Code Issue**:
```typescript
const finalExtra: any = {
  ...extraData,
  blockVersion: useBlockNote ? 2 : 1
};
// Missing: createdAt preservation or update
```
- **Impact**: Node creation dates are **lost during editor mode switching**, causing the "Created X ago" display in `BaseNode.tsx` to show "Invalid Date" or disappear.

### 2. **`createdAt` Never Set When Creating New Nodes**
- **Location**: `src/store/canvasStore.ts` - `addNode` function (lines 361-379)
- **Issue**: When adding new nodes, `createdAt` is **never automatically initialized** to the current ISO timestamp.
- **Impact**: All newly created AINote nodes lack creation dates, breaking the timestamp display.

### 3. **Date Not Synced to Firestore**
- **Location**: `src/lib/firebase/canvasData.ts` - `saveNode` function (lines 83-97)
- **Issue**: When persisting nodes to Firestore, `createdAt` is **not included in the saved document**.
- **Impact**: Dates are not persisted to the database, causing data loss on reload.

### 4. **Date Not Loaded from Firestore**
- **Location**: `src/lib/firebase/canvasData.ts` - `loadCanvasNodes` function (lines 9-29)
- **Issue**: When loading nodes from Firestore, `createdAt` is **never extracted from the document**.
- **Impact**: Even if dates were saved, they would never be restored.

### 5. **AINote Forces Tiptap Editor**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 105)
- **Issue**: `forceTiptap={true}` is hardcoded, which means AINote nodes **never benefit from BlockNote features** even when the hybrid editor is enabled.
```typescript
<HybridEditor
  forceTiptap={true} // BUG: This prevents BlockNote migration
  isGhost={!selected}
  nodeId={id}
/>
```
- **Impact**: Users cannot take advantage of the newer BlockNote editor for AI notes.

### 6. **Ghost Mode Conflicts with Editor State**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 106)
- **Issue**: `isGhost={!selected}` means the editor content renders differently based on selection state, but the `HybridEditor` component may re-render unexpectedly.
- **Impact**: Content may flicker or not render correctly when selecting/deselecting nodes.

## High Priority Bugs

### 7. **Memory Leak: Debounce Timeout Not Cleaned Up**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 39-43)
- **Issue**: The cleanup effect only clears the debounce timeout, but when the component unmounts during a pending debounce, the callback still fires after unmount.
```typescript
useEffect(() => {
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };
}, []);
// BUG: If debounce fires after unmount, updateNodeData will be called on a ghost reference
```
- **Impact**: Updates may be sent for deleted nodes, causing errors or corrupted state.

### 8. **Race Condition in Content Change Handler**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 45-56)
- **Issue**: The debounced callback captures `id` from closure, but if the node is deleted before the timeout fires, `updateNodeData` will be called with a stale reference.
```typescript
debounceRef.current = setTimeout(() => {
  updateNodeData(id, { ... }); // id may be stale
  scanContentForLinks(id, json); // id may be stale
}, 800);
```
- **Impact**: Updates may target wrong nodes or cause ghost reference errors.

### 9. **No Validation of `extraData` in Content Change Handler**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 45-56)
- **Issue**: `extraData` is spread directly into node data without validation, allowing potentially malicious or malformed data to be stored.
```typescript
updateNodeData(id, { 
  content: json, 
  pasteContent: undefined, 
  pasteFormat: undefined,
  ...extraData // BUG: No validation
});
```
- **Impact**: Malformed data could corrupt node state or cause rendering errors.

### 10. **Backlinks Fetched on Every Render**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 34)
- **Issue**: `backlinks` selector is called on every render, even though it doesn't change frequently.
```typescript
const backlinks = useCanvasStore((s) => s.backlinks[id] || []);
```
- **Impact**: Unnecessary re-renders when other parts of the store change.

### 11. **CountWords Recalculates on Every Render**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 58)
- **Issue**: `countWords` is called inside `useMemo` but the dependency array includes the entire `nodeData.content` object, which may not be stable.
```typescript
const stats = useMemo(() => countWords(nodeData.content), [nodeData.content]);
```
- **Impact**: Word counting may run unnecessarily when other properties in `nodeData` change.

### 12. **Progress Updates Bypass Debounce**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 101)
- **Issue**: `onProgressChange` is called directly without debouncing, which may cause excessive Firestore writes.
```typescript
onProgressChange={(progress) => updateNodeData(id, { progress })}
```
- **Impact**: Every keystroke could trigger a database update, causing performance issues.

## Medium Priority Bugs

### 13. **Date Display Crashes on Invalid Data**
- **Location**: `src/components/nodes/BaseNode.tsx` (lines 402-406)
- **Issue**: No validation before passing `createdAt` to `formatDistanceToNow`.
```typescript
{createdAt && (
  <div className="...">
    Created {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
  </div>
)}
```
- **Impact**: If `createdAt` is malformed, the app crashes with "Invalid Date".

### 14. **No "Last Modified" Tracking**
- **Location**: `src/components/editor/HybridEditor.tsx` and `src/types/canvas.ts`
- **Issue**: There's no `updatedAt` field to track when content was last changed, only `createdAt`.
- **Impact**: Users cannot see when content was last edited.

### 15. **Inconsistent Type Casting**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 31, 82)
- **Issue**: Type casting is done inconsistently - sometimes using `as unknown as AINoteNodeData`, sometimes using `as any`.
```typescript
const nodeData = data as unknown as AINoteNodeData;
color={(data as any).color}
```
- **Impact**: Type safety is compromised, making refactoring error-prone.

### 16. **Hardcoded 800ms Debounce May Be Too Short/Long**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 55)
- **Issue**: The debounce delay is hardcoded to 800ms with no way to configure it.
```typescript
debounceRef.current = setTimeout(() => {
  // ...
}, 800);
```
- **Impact**: May cause performance issues on slow devices or appear sluggish on fast devices.

### 17. **Ghost Content Uses Tiptap Format Always**
- **Location**: `src/components/editor/HybridEditor.tsx` (lines 74-79)
- **Issue**: Ghost content is always converted to Tiptap format even when BlockNote is the target editor.
```typescript
const ghostContent = useMemo(() => {
  if (!initialContent) return undefined;
  if (detectedVersion === 1) return initialContent as JSONContent;
  return migrateToTiPTap(initialContent); // BUG: Always converts to Tiptap
}, [initialContent, detectedVersion]);
```
- **Impact**: Ghost preview may not accurately represent BlockNote content.

### 18. **No Error Boundary Around Editor**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 97-108)
- **Issue**: If the `HybridEditor` throws an error, the entire node crashes without recovery.
- **Impact**: One corrupted node can crash the entire canvas.

### 19. **Backlink Node Lookup Inefficient**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 117-119)
- **Issue**: For each backlink, `allNodes.find()` is called, which is O(n) per backlink.
```typescript
{backlinks.map(sourceId => {
  const sourceNode = allNodes.find(n => n.id === sourceId); // O(n) lookup
  // ...
})}
```
- **Impact**: Performance degrades with many backlinks.

### 20. **No Cleanup of Paste Content After Use**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 103-104)
- **Issue**: `pasteContent` and `pasteFormat` are passed to the editor but never cleared from node data after use.
```typescript
pasteContent={nodeData.pasteContent}
pasteFormat={nodeData.pasteFormat}
```
- **Impact**: Stale paste content accumulates in node data, wasting storage.

## Low Priority Bugs

### 21. **CountWords Uses `extractText` Which May Not Handle BlockNote Format**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 12-24)
- **Issue**: `countWords` calls `extractText` from `contentParser.ts`, but this utility may not handle BlockNote's block array format correctly.
```typescript
function countWords(content: JSONContent | null | string): { words: number; chars: number } {
  if (!content) return { words: 0, chars: 0 };
  try {
    const text = extractText(content); // May not handle BlockNote format
```
- **Impact**: Word counts may be incorrect for BlockNote content.

### 22. **Placeholder Text Doesn't Match Node Purpose**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 102)
- **Issue**: The placeholder says "Paste an AI reply here…" but the node can contain any content.
```typescript
placeholder="Paste an AI reply here…"
```
- **Impact**: Misleading placeholder text for non-AI content.

### 23. **No Keyboard Shortcut for Re-parse**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 86-94)
- **Issue**: The re-parse button exists but there's no keyboard shortcut to trigger it.
- **Impact**: Users must use the mouse to re-parse markdown.

### 24. **No Loading State for Ghost Mode**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 106)
- **Issue**: When `isGhost={true}`, there's no indication that content is loading.
- **Impact**: Users may see empty nodes briefly before content renders.

### 25. **Footer Stats Only Show When Words > 0**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 59)
- **Issue**: Footer stats are hidden when the node is empty, but users may want to see character count for empty nodes.
```typescript
const footerStats = stats.words > 0 ? `${stats.words} words · ${stats.chars} chars` : undefined;
```
- **Impact**: Inconsistent UI where empty nodes show no stats.

### 26. **Sync Status Is Hardcoded to False**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 84)
- **Issue**: `isSyncing` is always `false`, providing no real sync feedback.
```typescript
isSyncing={false} // Placeholder for real sync state
```
- **Impact**: Users have no indication of whether their changes are being saved.

### 27. **No Debounce for Title Changes**
- **Location**: `src/components/nodes/AINoteNode.tsx` (line 67)
- **Issue**: Title changes are saved immediately without debouncing.
```typescript
onTitleChange={(title) => updateNodeData(id, { title })} // No debounce
```
- **Impact**: Every keystroke in the title triggers a save, causing excessive Firestore writes.

### 28. **Collapse Toggle Doesn't Sync Height Properly**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 71-75)
- **Issue**: Setting `height: 'auto'` when collapsing may not properly restore the previous height when uncollapsing.
```typescript
onToggleCollapse={() => {
  const isCollapsed = !nodeData.collapsed;
  updateNodeData(id, { collapsed: isCollapsed });
  useCanvasStore.getState().updateNodeStyle(id, { height: 'auto' }); // BUG: loses previous height
}}
```
- **Impact**: Node may not restore to its original size after uncollapsing.

### 29. **Backlink Click Doesn't Expand Collapsed Node**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 121-127)
- **Issue**: Clicking a backlink focuses the source node but doesn't expand it if it's collapsed.
```typescript
onClick={(e) => { 
  e.stopPropagation(); 
  setFocusedNodeId(sourceId); 
  // BUG: Should also expand collapsed nodes
}}
```
- **Impact**: Users may click a backlink and not see the content.

### 30. **No Type Safety for Node Data Updates**
- **Location**: `src/components/nodes/AINoteNode.tsx` (lines 45-56)
- **Issue**: `Partial<AINoteNodeData>` is used but doesn't ensure required fields are present.
```typescript
const handleContentChange = useCallback((json: JSONContent, extraData?: Partial<AINoteNodeData>) => {
  // ...
  updateNodeData(id, { 
    content: json, 
    ...extraData // BUG: No type checking on extraData
  });
```
- **Impact**: Invalid data could be written to the node.

## Summary Table

| Priority | Bug | Location | Impact |
|----------|-----|----------|--------|
| Critical | createdAt lost during migration | HybridEditor.tsx | Date display broken |
| Critical | createdAt not set on new nodes | canvasStore.ts | Missing timestamps |
| Critical | Dates not saved to Firestore | canvasData.ts | Data loss |
| Critical | Dates not loaded from Firestore | canvasData.ts | Timestamps never restore |
| Critical | AINote forces Tiptap | AINoteNode.tsx:105 | BlockNote never used |
| Critical | Ghost mode conflicts | AINoteNode.tsx:106 | UI flickering |
| High | Memory leak in debounce | AINoteNode.tsx:39-43 | Stale callbacks |
| High | Race condition in handler | AINoteNode.tsx:45-56 | Wrong node updates |
| High | No validation of extraData | AINoteNode.tsx:45-56 | Data corruption |
| High | Backlinks fetched every render | AINoteNode.tsx:34 | Performance issue |
| High | CountWords recalculates often | AINoteNode.tsx:58 | Performance issue |
| High | Progress updates bypass debounce | AINoteNode.tsx:101 | Excessive writes |
| Medium | Date display crashes | BaseNode.tsx:402-406 | App crash |
| Medium | No updatedAt tracking | HybridEditor.tsx | No edit timestamps |
| Medium | Inconsistent type casting | AINoteNode.tsx:31,82 | Type safety issues |
| Medium | Hardcoded debounce delay | AINoteNode.tsx:55 | Performance tuning difficult |
| Medium | Ghost uses wrong format | HybridEditor.tsx:74-79 | Incorrect preview |
| Medium | No error boundary | AINoteNode.tsx:97-108 | One node crashes all |
| Medium | Inefficient backlink lookup | AINoteNode.tsx:117-119 | Performance issue |
| Medium | Paste content never cleared | AINoteNode.tsx:103-104 | Storage waste |
| Low | extractText may not handle BlockNote | AINoteNode.tsx:12-24 | Incorrect word count |
| Low | Misleading placeholder | AINoteNode.tsx:102 | UX confusion |
| Low | No keyboard shortcut | AINoteNode.tsx:86-94 | UX inefficiency |
| Low | No loading state in ghost | AINoteNode.tsx:106 | UX confusion |
| Low | Stats hidden for empty nodes | AINoteNode.tsx:59 | Inconsistent UI |
| Low | Sync status hardcoded | AINoteNode.tsx:84 | No sync feedback |
| Low | No debounce for titles | AINoteNode.tsx:67 | Excessive writes |
| Low | Collapse height sync broken | AINoteNode.tsx:71-75 | UI glitch |
| Low | Backlink doesn't expand | AINoteNode.tsx:121-127 | UX issue |
| Low | No type safety for updates | AINoteNode.tsx:45-56 | Potential bugs |

This comprehensive analysis reveals **30 distinct bugs** in the AINote node component and its related systems, ranging from critical data loss issues to minor UX problems.