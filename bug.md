## make sure it dont break the backend ,backup or old nodes ,workspaces 

## **Final Consolidated Bug List**

### **✅ Fixed / Already Correct (3 bugs)**
1.  **Backlinks System** (`src/store/canvasStore.ts:164-205`) - Correctly merges content and edge backlinks.
2.  **Handle ID Consistency** (`src/lib/constants/canvas.ts`) - Consistent across components.
3.  **Edge Deletion via Store** (`src/components/canvas/CustomEdge.tsx:239`) - Uses store's `onEdgesChange`.

### **⚠️ Unfixed / Remaining Issues (31 bugs)**

#### **Critical (Data Corruption/Sync Issues) - 8 bugs**
| # | Bug | Location | Description |
|---|-----|----------|-------------|
| C1 | Race condition in `loadCanvas` | `src/store/canvasStore.ts:422-430` | Multiple rapid calls can reset `_skipSync` incorrectly. |
| C2 | Node duplication data loss | `src/store/canvasStore.ts:280-299` | `JSON.parse(JSON.stringify(...))` strips `undefined` values. |
| C3 | Race condition in `replayPendingOps` | `src/lib/cache/canvasCache.ts:470-584` | Flag might not reset if uncaught exception occurs. |
| C4 | Race condition: Replay vs Load Complete | `src/pages/WorkspacePage.tsx:102, 106` | Sync runs before canvas is fully loaded. |
| C5 | Import ID collision handling | `src/components/canvas/CanvasToolbar.tsx:248-263` | Doesn't check for collisions with existing nodes. |
| C6 | Node deletion not cleaning up ghost edges | `src/store/canvasStore.ts:267-282` | Edges might remain if format differs. |
| C7 | Edge update persistence (null values) | `src/store/canvasStore.ts:344-354` | Doesn't handle `null` values properly. |
| C8 | Edge label update bypasses store | `src/components/canvas/CustomEdge.tsx:280-290` | Direct state update bypasses history. |

#### **Medium (User Experience/Performance) - 10 bugs**
| # | Bug | Location | Description |
|---|-----|----------|-------------|
| M1 | Random node placement | `src/components/canvas/AddNodeToolbar.tsx:137` | Nodes placed at random positions. |
| M2 | Layout ignores locked nodes | `src/components/canvas/CanvasToolbar.tsx:160-197` | Moves locked nodes against user intent. |
| M3 | Memory leak - sync manager | `src/lib/cache/canvasCache.ts:627-681` | Global state not cleaned up on reload. |
| M4 | Memory leak - event listeners | `src/lib/cache/canvasCache.ts:353-366` | Event listeners not cleaned up. |
| M5 | Cleanup of timeouts | `src/pages/WorkspacePage.tsx:123-253` | Timeouts might not be cleared properly. |
| M6 | Zero size nodes in `computeBestHandles` | `src/components/canvas/CanvasWrapper.tsx:91-121` | Center calculations incorrect for zero-size nodes. |
| M7 | Zoom button state sync | `src/components/canvas/CanvasToolbar.tsx:433-441` | No minimum zoom limit check. |
| M8 | Zoom out below zero | `src/components/canvas/CanvasToolbar.tsx:114` | Can zoom to negative percentages. |
| M9 | Context menu z-index conflicts | Multiple files | Inconsistent z-index values. |
| M10 | Undo/Redo history capacity | `src/store/canvasStore.ts:586` | Limited to 50 snapshots. |

#### **Minor (Visual/State/Validation) - 16 bugs**
| # | Bug | Location | Description |
|---|-----|----------|-------------|
| m1 | Context menu position bug | `src/components/canvas/NodeContextMenu.tsx:232-235` | Doesn't account for scroll position. |
| m2 | Empty edge labels | `src/components/canvas/CustomEdge.tsx:588-594` | Doesn't prevent saving empty labels. |
| m3 | Drawing mode state sync | `src/components/canvas/CanvasToolbar.tsx:418` | State not synchronized with store. |
| m4 | Spring animation cleanup | `src/components/canvas/CustomEdge.tsx:213-219` | Physics state not reset on unmount. |
| m5 | Undefined `nodeLookup` | `src/components/nodes/BaseNode.tsx:114-118` | Doesn't handle undefined `nodeLookup`. |
| m6 | Missing data validation in AINoteNode | `src/components/nodes/AINoteNode.tsx:10-16` | No validation for `content` type. |
| m7 | Missing array validation in ChecklistNode | `src/components/nodes/ChecklistNode.tsx:15-19` | Assumes `items` is always an array. |
| m8 | Layout menu z-index | `src/components/canvas/CanvasToolbar.tsx:490-510` | Might conflict with other UI elements. |
| m9 | Import/Export menu cleanup | `src/components/canvas/CanvasToolbar.tsx:226-335` | Menu state might not reset on error. |
| m10 | Keyboard shortcut conflict | `src/components/canvas/CanvasToolbar.tsx:513-515` | `Ctrl+K`/`Cmd+K` might conflict with global search. |
| m11 | Node context menu position | `src/components/canvas/NodeContextMenu.tsx:233-234` | Doesn't account for viewport changes. |
| m12 | State updates in edge context menu | `src/components/canvas/EdgeContextMenu.tsx:59-60` | Bypasses store's state management. |
| m13 | Missing cleanup in node context menu | `src/components/canvas/NodeContextMenu.tsx:216-250` | AI loading states not cleaned up. |
| m14 | Event propagation in edge context menu | `src/components/canvas/EdgeContextMenu.tsx:70` | Doesn't stop propagation. |
| m15 | Backlink sync issues | `src/store/canvasStore.ts:168-182` | Doesn't check if source node exists. |
| m16 | Visual glitches when moving nodes rapidly | `src/components/canvas/CanvasWrapper.tsx:205-223` | Local state lags behind store state. |

## **Clarifying Questions for Implementation Plan**

Before creating the detailed implementation plan, I need your input on the following tradeoffs:

1.  **Priority Order:** 
    *   Should I fix critical sync issues (C1-C4) first, or address all critical bugs (C1-C8) in a comprehensive pass?
    *   Should medium and minor bugs be addressed in separate phases?

2.  **Node Placement (M1):** 
    *   A. Center of current viewport
    *   B. Grid-based placement
    *   C. Relative to last node

3.  **Edge Labels (m2):** 
    *   Should empty labels be prevented or allowed?

4.  **Drawing Mode (m3):** 
    *   Should drawing mode state be moved to store or kept as prop?

5.  **History Capacity (M10):** 
    *   Should I increase the limit from 50 to 100, or implement a more sophisticated system?

**Recommendation:** 
1. Phase 1: Fix critical sync issues (C1-C4) and data corruption bugs (C5-C8).
2. Phase 2: Fix medium UX/performance issues (M1-M10).
3. Phase 3: Fix minor visual/state issues (m1-m16).

Please provide your preferences, and I will create a detailed implementation plan.