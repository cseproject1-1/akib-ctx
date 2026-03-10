# 📋 CtxNote 25-Feature Improvement Plan (Todo List)

## Part 1: Performance Improvements (Features 1-5)

- [x] **Feature 1: Optimize Zustand Store Selectors**
  - [x] Audit all component subscriptions to canvasStore
  - [x] Replace global destructuring with selective selectors
  - [x] Create custom hooks for common patterns: `useNodes()`, `useEdges()`, `useSelectedNodes()`
  - [x] Add memoization for expensive derived state

- [x] **Feature 2: Implement Virtualization for Large Canvases**
  - [x] Enhance existing viewport culling with React.memo on nodes
  - [x] Add `shouldRenderer` prop to skip rendering off-screen nodes entirely
  - [x] Implement node pooling for frequently accessed nodes
  - [x] Add "render window" concept - only render nodes within viewport + buffer .but must skip audio , video and img from this .

- [x] **Feature 3: Memoize All Node Components**
  - [x] Add `React.memo` to ChecklistNode, StickyNoteNode, ShapeNode, VideoNode
  - [x] Implement custom comparison functions for complex props
  - [x] Move inline functions outside component or use useCallback
  - [x] Create `src/lib/utils/nodeMemo.ts` helper

- [x] **Feature 4: Debounce Node Position Updates**
  - [x] Create debounce utility: `src/lib/utils/debounce.ts`
  - [x] Modify `onNodesChange` to batch position changes
  - [x] Add `_pendingPositionUpdates` map in store (implemented via CanvasWrapper local state)
  - [x] Flush pending updates every 300ms or on drag end
  - [x] Update canvasCache.ts to handle batched updates (handled via Zustand batching in component)

- [x] **Feature 5: Lazy Load Heavy Editor Extensions**
  - [x] Create extension registry: `src/lib/tiptap/extensionRegistry.ts`
  - [x] Add lazy loading for KaTeXExtension, CodeBlockLowlight, CustomBlockExtensions
  - [x] Modify getEditorExtensions to accept feature flags
  - [x] Add code splitting at bundle level

---

## Part 2: Bug Fixes (Features 6-10)

- [x] **Feature 6: Fix Node Selection State Race Condition**
  - [x] Modify `handleSelectionChange` to use synchronous setState
  - [x] Add immediate z-index assignment without animation delay
  - [x] Fix in `canvasStore.ts` with functional updates

- [x] **Feature 7: Fix Offline Sync Edge Cases**
  - [x] Add timestamp-based conflict resolution
  - [x] Validate pending op data before replay
  - [x] Add "orphaned node" detection for deleted parent relationships
  - [x] Implement exponential backoff with jitter

- [x] **Feature 8: Fix Handle Visibility Bug**
  - [x] Remove useStore subscription from BaseNode for handle logic
  - [x] Use CSS-only approach with parent hover
  - [x] Keep selected handles always visible
  - [x] Add data-handle-visible attribute for programmatic control

- [x] **Feature 9: Fix Memory Leaks in Event Listeners**
  - [x] Audit all useEffect hooks with event listeners
  - [x] Add AbortController pattern
  - [x] Add cleanup for keyboard listener in CanvasWrapper.tsx
  - [x] Add cleanup for online/offline listeners, clear intervals in canvasCache.ts

- [x] **Feature 10: Fix Editor Paste Handler**
  - [x] Add more robust KaTeX detection with DOMParser
  - [x] Add error boundary around paste handler
  - [x] Log failed paste attempts for debugging

---

## Part 3: Node Improvements (Features 11-18)

- [x] **Feature 11: Add Node Templates System**
  - [x] Add template storage interface
  - [x] Add template functions to canvasStore
  - [x] Add UI: Template picker in AddNodeToolbar
  - [x] Persist to localStorage (or cloud if authenticated)

- [x] **Feature 12: Improve Multi-Node Operations**
  - [x] Add alignment functions in canvasStore
  - [x] Implement alignment and distribution algorithms
  - [x] Add toolbar buttons (Left/Center/Right, Top/Middle/Bottom, Distribute)
  - [x] Add keyboard shortcuts: Ctrl+Arrow for alignment

- [x] **Feature 13: Add Auto-Layout Algorithm**
  - [x] Install: `npm install dagre`
  - [x] Create layout utility `autoLayoutNodes`
  - [x] Add store action `autoLayout`
  - [x] Add UI Layout button in CanvasToolbar

- [x] **Feature 14: Add Node Groups with Collapsible Folders**
  - [x] Create GroupNode component
  - [x] Add to nodeTypes
  - [x] Store group membership (NodeGroup interface)
  - [x] Add grouping actions to store

- [x] **Feature 15: Improve Node Search & Filter**
  - [x] Extend SearchPalette with SearchFilters interface
  - [x] Add filter chips UI
  - [x] Implement content search across all node data
  - [x] Add "jump to result" with viewport centering

- [x] **Feature 16: Add Floating "Action Palette" for Selected Nodes**
  - [x] Create node history store (or Action Palette context)
  - [x] Add snapshot save/restore actions (or Quick action items)
  - [x] Limit history to last 20 versions per node
  - [x] Add Node context menu -> "View History" (Replaced with Action Palette)

- [x] **Feature 17: Add Interactive Tutorial System**
  - [x] Configure tutorial steps and popovers
  - [x] Add tutorial highlighting and anchoring
  - [x] Add skip functionality
  - [x] Show tutorial indicator in toolbar

- [x] **Feature 18: Add Node Linking Animations**
  - [x] Add CSS animated dash pattern
  - [x] Add edge selection highlighting
  - [x] Add hover effect showing connection direction
  - [x] Add "pulse" animation on new connections

---

## Part 4: Editor Improvements (Features 19-25)

- [ ] **Feature 19: Add Real-Time Collaboration**
  - [ ] Install: `yjs`, `@tiptap/extension-collaboration`, `y-websocket`
  - [ ] Create collaboration provider using IndexeddbPersistence
  - [ ] Add presence awareness
  - [ ] Handle conflict resolution

- [x] **Feature 20: Improve Markdown Import/Export**
  - [x] Enhance markdown serialization with tiptap-markdown
  - [x] Add file import parsing frontmatter
  - [x] Add export menu: Markdown, HTML, PDF

- [ ] **Feature 21: Add Voice Notes Support**
  - [ ] Create VoiceRecording extension
  - [ ] Add recording UI in editor toolbar
  - [ ] Store audio as blob, upload to R2
  - [ ] Add playback controls

- [x] **Feature 22: Add Diagram Drawing in Editor**
  - [x] Install `mermaid`
  - [x] Create Mermaid extension
  - [x] Add slash command to insert diagram
  - [x] Add live preview while editing
  - [x] Export as SVG/PNG

- [x] **Feature 23: Improve Slash Command Menu**
  - [x] Add fuzzy search using `fuse.js`
  - [x] Add categories: Basic, Media, Advanced
  - [x] Add keyboard navigation (Arrow keys + Enter)
  - [x] Add recent commands and shortcut hints

- [x] **Feature 24: Add Editor Macro System**
  - [x] Create macro manager extension: `src/lib/tiptap/MacroExtension.ts`
  - [x] Add "Start Recording" button in EditorFooter
  - [x] Track user actions during recording and allow replay
  - [x] Store macros in localStorage

- [x] **Feature 25: Add Table Improvements**
  - [x] Add cell resizing handles
  - [x] Add formula support (evaluateFormula)
  - [x] Add row/column insert/delete buttons
  - [x] Add "Convert to CSV" export option
  - [x] Add zebra striping
