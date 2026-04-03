# Fixed Bugs Tracker

> All fixes verified: TypeScript type check passed, production build succeeded.
> Last updated: April 2, 2026 — **52 bugs fixed**

## Verification Status
- `npx tsc --noEmit` — **PASSED** (0 errors)
- `npm run build` — **PASSED**

---

## All Fixed Bugs

### BaseNode (N6, N7, N9, N24, N25, N61) ✅
| Bug | File | Fix |
|-----|------|-----|
| N6 | `BaseNode.tsx:217` | Removed `overflow-hidden` |
| N7 | `BaseNode.tsx:245` | Resize uses `nodeId \|\| id` |
| N9 | `BaseNode.tsx:222,224` | Removed `animate-pulse` |
| N24 | `BaseNode.tsx:289` | Added `flex-shrink-0` to header buttons |
| N25 | `BaseNode.tsx:410` | Fixed via N6 |
| N61 | `BaseNode.tsx:348` | `[...new Set(nodeTags)]` dedup |

### TextNode (N11, N12, N26) ✅
| Bug | File | Fix |
|-----|------|-----|
| N11 | `TextNode.tsx:49` | Controlled `value={editValue}` |
| N12 | `TextNode.tsx:57` | Debounced height update (200ms) |
| N26 | `TextNode.tsx:89` | Removed duplicate selection border |

### CodeSnippetNode (N3, N16, N17, N40) ✅
| Bug | File | Fix |
|-----|------|-----|
| N3 | `CodeSnippetNode.tsx:171` | lowlight escapes content (low risk, verified safe) |
| N16 | `CodeSnippetNode.tsx:122` | Controlled `value={editValue}` |
| N17 | `CodeSnippetNode.tsx:54` | setTimeout in ref, cleanup on unmount |
| N40 | `CodeSnippetNode.tsx:45` | Added `touchstart` listener |

### DatabaseNode (N4, N5, N30, N31) ✅
| Bug | File | Fix |
|-----|------|-----|
| N4 | `DatabaseNode.tsx:112` | `crypto.randomUUID()` |
| N5 | `DatabaseNode.tsx:62` | `getState()` for latest rows |
| N30 | `DatabaseNode.tsx:15` | Removed unused import |
| N31 | `DatabaseNode.tsx:130` | `bg-muted` instead of `bg-black/20` |

### ImageNode (N13) ✅
| N13 | `ImageNode.tsx:69` | `handleUpload` in `useCallback` |

### PDFNode (N13, N14) ✅
| N13 | `PDFNode.tsx:96` | `handleUpload` in `useCallback` |
| N14 | `PDFNode.tsx:88` | File type validation |

### BookmarkNode (N18) ✅
| N18 | `BookmarkNode.tsx:37` | AbortController |

### EmbedNode (N2, N19, N34) ✅
| N2 | `EmbedNode.tsx:319` | Removed `allow-same-origin` |
| N19 | `EmbedNode.tsx:121` | AbortController |
| N34 | `EmbedNode.tsx:246` | Removed `autoFocus` |

### AINoteNode (N10) ✅
| N10 | `AINoteNode.tsx:247` | Reactive selector for isSyncing |

### FlashcardNode (N20) ✅
| N20 | `FlashcardNode.tsx:32` | Guard for `totalCards === 0` |

### ChecklistNode (N21, N49, N50) ✅
| N21 | `ChecklistNode.tsx` | Mutators in `useCallback` |
| N49 | `ChecklistNode.tsx:61` | 100ms throttle |
| N50 | `ChecklistNode.tsx:37` | 500 char maxLength |

### TableNode (N22) ✅
| N22 | `TableNode.tsx:57` | `URL.revokeObjectURL()` |

### VideoNode (N35) ✅
| N35 | `VideoNode.tsx:93` | Removed `autoFocus` |

### KanbanNode (N37) ✅
| N37 | `KanbanNode.tsx:203` | Ref-based focus |

### DrawingNode (N41, N42, N43, N58) ✅
| N41 | `DrawingNode.tsx:62` | `xMidYMid meet` |
| N42 | `DrawingNode.tsx:68` | `key={p.id \|\| i}` |
| N43 | `DrawingNode.tsx:71` | `Math.sqrt(scaleX*scaleY)` |
| N58 | `DrawingNode.tsx:26` | Only set when both undefined |

### MathNode (N56) ✅
| N56 | `MathNode.tsx:27` | Hash-based placeholder |

### FileAttachmentNode (U18) ✅
| U18 | `FileAttachmentNode.tsx:169` | relatedTarget check |

### DailyLogNode (A4) ✅
| A4 | `DailyLogNode.tsx:73,85,115` | `e.stopPropagation()` on buttons |

### EdgeContextMenu (U3, U24) ✅
| U3 | `EdgeContextMenu.tsx` | Single AnimatePresence |
| U24 | `EdgeContextMenu.tsx:4` | Removed unused imports |

### BatchToolbar (U13) ✅
| U13 | `BatchToolbar.tsx:37` | `pushSnapshot()` before delete |

### NodeContextMenu (U12, U25) ✅
| U12 | `NodeContextMenu.tsx:103` | Clamped submenu |
| U25 | `NodeContextMenu.tsx:177` | execCommand fallback |

### CanvasWrapper (U21, U22) ✅
| U21 | `CanvasWrapper.tsx:1` | Removed duplicate import |
| U22 | `CanvasWrapper.tsx:293` | Removed unused vars |

### CanvasToolbar (U11) ✅
| U11 | `CanvasToolbar.tsx:112` | Check for open dialogs |

### DrawingOverlay (U4) ✅
| U4 | `DrawingOverlay.tsx:92` | Resize observer |

### LinkPeekCard (U30, U31) ✅
| U30 | `LinkPeekCard.tsx:85` | try-catch on URL |
| U31 | `LinkPeekCard.tsx:21` | `.catch()` on fetch |

### HotkeySettingsModal (U32) ✅
| U32 | `HotkeySettingsModal.tsx:27` | Check target tag |

### PresentationMode (A1) ✅
| A1 | `PresentationMode.tsx:415` | Sanitized href, rejected javascript: |

### AuthContext (B20, B41) ✅
| B20 | `AuthContext.tsx:114` | try/catch on signOut |
| B41 | `AuthContext.tsx:138` | console.warn on HMR fallback |

### Settings Store (W18) ✅
| W18 | `settingsStore.ts` | Separate timers |

### ImportPage (B18) ✅
| B18 | `ImportPage.tsx:22` | URL validation |

### SignupPage (B34) ✅
| B34 | `SignupPage.tsx:46` | Error capture + toast |

### aiService (B36) ✅
| B36 | `aiService.ts:1` | Removed unused toast import |

### R2 Storage (B26, B27) ✅
| B26 | `storage.ts:92` | 50MB file size limit |
| B27 | `storage.ts:92` | MIME type allowlist |

### Workspaces (B10, B43, W15, W16, W19, W28) ✅
| B10 | `workspaces.ts:95` | All 5 subcollections |
| B43 | `canvasData.ts:111` | Removed unused UUID_LENIENT_RE |
| W15 | `canvasData.ts:173` | createSnapshot accepts drawings |
| W16 | `workspaces.ts:142` | Added default fields to branch |
| W19 | `workspaces.ts:121` | Sequential deletion |
| W28 | `canvasData.ts:203` | limit() + writeBatch |

---

## Summary
| Category | Fixed | Remaining | Total |
|----------|-------|-----------|-------|
| Node components | 22 | 33 | 55 |
| Canvas/UI | 12 | 14 | 26 |
| Backend | 6 | 35 | 41 |
| Workspace | 6 | 22 | 28 |
| Editor Migration | 0 | 32 | 32 |
| Additional UI | 3 | 11 | 14 |
| **TOTAL** | **52** | **107** | **159** |
