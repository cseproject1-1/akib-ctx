# 📋 CtxNote Feature Roadmap (Next Phase)

All previous features (1–18, 20, 22–25) have been completed. ✅

---

## 🟠 Part 2: New Node Types

- [x ] **Feature 2: KanbanNode**
  - [ ] Create `src/components/nodes/KanbanNode.tsx` with To-Do / In Progress / Done columns
  - [ ] Support drag-and-drop cards between columns
  - [ ] Persist column state in node `data`

- [ x] **Feature 3: BookmarkNode (URL Preview Card)**
  - [ ] Create `src/components/nodes/BookmarkNode.tsx`
  - [ ] Fetch Open Graph metadata (title, description, image) via worker proxy
  - [ ] Display as a rich link card with favicon

- [x ] **Feature 4: CalendarNode**
  - [ ] Create `src/components/nodes/CalendarNode.tsx` using `react-day-picker` (already installed)
  - [ ] Allow adding labeled events/reminders per date
  - [ ] Persist events in node `data`

- [x ] **Feature 5: FileAttachmentNode**
  - [ ] Create `src/components/nodes/FileAttachmentNode.tsx`
  - [ ] Drag-and-drop file upload → store in Cloudflare R2
  - [ ] Show file name, size, type icon, and download link

- [x ] **Feature 6: SpreadsheetNode**
  - [ ] Create `src/components/nodes/SpreadsheetNode.tsx`
  - [ ] Editable grid with basic formula support (extend `TableNode` formula engine)
- [x] **Feature 2: KanbanNode**
  - [x] Create `src/components/nodes/KanbanNode.tsx` with To-Do / In Progress / Done columns
  - [x] Support drag-and-drop cards between columns
  - [x] Persist column state in node `data`

- [x] **Feature 3: BookmarkNode (URL Preview Card)**
  - [x] Create `src/components/nodes/BookmarkNode.tsx`
  - [x] Fetch Open Graph metadata (title, description, image) via worker proxy
  - [x] Display as a rich link card with favicon

- [x] **Feature 4: CalendarNode**
  - [x] Create `src/components/nodes/CalendarNode.tsx` using `react-day-picker` (already installed)
  - [x] Allow adding labeled events/reminders per date
  - [x] Persist events in node `data`

- [x] **Feature 5: FileAttachmentNode**
  - [x] Create `src/components/nodes/FileAttachmentNode.tsx`
  - [x] Drag-and-drop file upload → store in Cloudflare R2
  - [x] Show file name, size, type icon, and download link

- [x] **Feature 6: SpreadsheetNode**
  - [x] Create `src/components/nodes/SpreadsheetNode.tsx`
  - [x] Editable grid with basic formula support (extend `TableNode` formula engine)
  - [x] Support CSV import/export

---

## 🟡 Part 3: Canvas / Workspace Tools

- [x] **Feature 6: Minimap Toggle**
  - [x] Add a button in the bottom-center toolbar (near zoom) to toggle the Minimap visibility.
  - [x] Minimap should be hidden by default in "Share/View" mode.
- [x] **Feature 7: Conditional Minimap**
  - [x] Ensure the minimap is completely removed from the DOM when in share mode to prevent clutter.
- [x] **Feature 8: Canvas Background Themes**
  - [x] Add at least 5 different background grid styles (dots, lines, cross, graph paper, blank).
  - [x] Allow cycling through them via a toolbar button or hotkey (G).
- [x] **Feature 9: Node Lock**
  - [x] Add a "Lock" button in the node context menu or base node header.
  - [x] Locked nodes cannot be dragged or deleted until unlocked.
- [x] **Feature 10: Canvas Viewport Bookmarks**
  - [x] Add `bookmarks` to canvas store (name + viewport {x, y, zoom})
  - [x] Add bookmark button in `CanvasToolbar.tsx` to save current view
  - [x] Show list of bookmarks in a dropdown; click to fly to that view
- [x] **Feature 11: Infinite Undo/Redo (Command History)**
  - [x] Implement history diffing (already have basic undo/redo, maybe refine)
  - [x] Add a history panel to see past actions and revert to specific points
- [x] **Feature 12: Multi-Workspace Tabs**
  - [x] Allow opening multiple workspaces in the same session with browser-like tabs at the top of the canvas
  - [x] Quickly switch between open workspaces without full page reloadsly
  - [x] Lazy-load workspace data per tab

---

## 🟢 Part 4: Editor (Tiptap) Improvements

- [x] **Feature 14: Document Outline Panel**
  - [x] Parse heading hierarchy from Tiptap document
  - [x] Display as collapsible outline in a side panel
  - [x] Click heading to scroll editor to that position

- [x] **Feature 15: Find & Replace in Editor**
  - [x] Add Ctrl+H panel inside the Tiptap editor
  - [x] Support RegEx search and match case-sensitive options
  - [x] Step through with Next/Previous highlights

- [x] **Feature 16: Focus / Typewriter Mode**
  - [x] Create a distraction-free mode (wide margins, centered)
  - [x] Auto-scroll so current line is always centered (Typewriter)
  - [x] Toggle via keyboard shortcut (Ctrl+Shift+D)

- [x] **Feature 17: AI Multi-Node Synthesis** (Advanced)
  - [x] Select multiple nodes and ask AI to synthesize
  - [x] Create new notes from AI synthesis directly on canvas

---

## 🔵 Part 5: Dashboard & UX

- [x] **Feature 18: Workspace Tags & Folders**
  - [x] Add color-coded tags to workspaces in `Dashboard.tsx`
  - [x] Filter/search workspaces by tag
  - [x] Add folder/group hierarchy for workspace list (recursive/virtual)
  - [x] Implement Workspace Trash Bin (soft delete & restore system)

- [x] **Feature 19: Workspace Stats Cards**
  - [x] Show node count, word count, last edited, creation date per workspace
  - [x] Display on workspace card hover (Info icon) or detail card

- [x] **Feature 20: Import from Notion / Obsidian**
  - [x] Parse Notion HTML export or Obsidian `.md` vault export
  - [x] Convert headings/paragraphs/lists into appropriate canvas nodes
  - [x] Add import button to `Dashboard.tsx`

- [x] **Feature 21: Hotkey Customization**
  - [x] Add a hotkey settings panel (searchable)
  - [x] Allow users to remap keyboard shortcuts
  - [x] Persist custom mappings to Firestore per user
  - [x] Implement 'Empty Trash' logic for bin cleanup

---

## ⚙️ Part 6: Infrastructure & DX

- [x] **Feature 22: PWA support**
  - [x] Configured `vite-plugin-pwa` with manifest and icons
  - [x] Implemented `autoUpdate` service worker
  - [x] Added `usePWAInstall` for manual install prompt
  - [x] Install button shows in sidebar until app is installed

- [ ] **Feature 23: Bundle Analyzer**
  - [ ] Install `rollup-plugin-visualizer`
  - [ ] Add `analyze` script to `package.json`
  - [ ] Document current bundle size baseline

- [ ] **Feature 24: Error Monitoring (Sentry)**
  - [ ] Install `@sentry/react`
  - [ ] Configure DSN via `.env.local`
  - [ ] Add error boundary reporting and performance tracing
