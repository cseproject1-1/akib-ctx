# Fix Plan - CtxNote Bug Remediation

**Total Bugs:** 78  
**Target Completion:** 8 weeks  
**Current Status:** Not Started

---

## Phase 1: Critical Security Fixes (Week 1)

### Priority 1: Credential Exposure & Authentication

| Bug | Task | Files to Modify | Est. Time |
|-----|------|-----------------|-----------|
| B2 | Remove R2 credentials from client bundle. Move to Worker presigned URLs | `src/lib/r2/client.ts`, `src/lib/r2/storage.ts`, `worker/src/index.ts` | 4 hours |
| B4 | Add Firebase ID token authentication to all Worker endpoints | `worker/src/index.ts` | 3 hours |
| B1 | Add SSRF protection: validate URL scheme, block private IPs | `worker/src/index.ts` | 2 hours |
| B3 | Move Gemini API key from query param to HTTP header | `worker/src/index.ts` | 30 min |

**Acceptance Criteria:**
- [ ] No `VITE_R2_*` variables in client code
- [ ] All Worker endpoints require valid Firebase ID token
- [ ] `/api/urlMetadata` rejects private/internal URLs
- [ ] Gemini API key not in query strings

---

### Priority 2: Data Security Fixes

| Bug | Task | Files to Modify | Est. Time |
|-----|------|-----------------|-----------|
| B6 | Move password verification server-side | `worker/src/index.ts`, `src/lib/firebase/workspaces.ts` | 4 hours |
| B7 | Restrict Firestore users collection to own document only | `firestore.rules`, `src/hooks/useAdminData.ts` | 1 hour |
| B39 | Fix Firestore users collection read rules | `firestore.rules` | 30 min |

**Acceptance Criteria:**
- [ ] Password hashes never sent to client
- [ ] Users can only read their own profile
- [ ] Admin checks enforced server-side

---

### Priority 3: Critical Migration Fixes - List Wrapping

| Bug | Task | Files to Modify | Est. Time |
|-----|------|-----------------|-----------|
| M5 | Add list container wrapping logic for Tiptap migration | `src/lib/editor/migration.ts` | 6 hours |
| M9 | Add nested list container wrapping | `src/lib/editor/migration.ts` | 4 hours |

**Implementation:**
```typescript
// In migrateToTiPTap function, after converting blocks:
function wrapListItems(nodes: TiptapNode[]): TiptapNode[] {
  const result: TiptapNode[] = [];
  let currentList: TiptapNode | null = null;
  let currentListType: string | null = null;

  for (const node of nodes) {
    if (node.type === 'listItem') {
      const listType = node.attrs?.order !== undefined ? 'orderedList' : 'bulletList';
      
      if (currentListType !== listType) {
        if (currentList) result.push(currentList);
        currentList = { type: listType, content: [] };
        currentListType = listType;
      }
      currentList?.content?.push(node);
    } else {
      if (currentList) {
        result.push(currentList);
        currentList = null;
        currentListType = null;
      }
      result.push(node);
    }
  }
  
  if (currentList) result.push(currentList);
  return result;
}
```

**Acceptance Criteria:**
- [ ] Lists render correctly in Tiptap after migration
- [ ] Nested lists preserve hierarchy
- [ ] Round-trip migration preserves list structure

---

### Priority 4: Critical Migration Fixes - Type Names

| Bug | Task | Files to Modify | Est. Time |
|-----|------|-----------------|-----------|
| M1 | Fix toggle child type names to match extension schema | `src/lib/editor/migration.ts` | 1 hour |
| M4 | Fix video/audio type names to match extension names | `src/lib/editor/migration.ts` | 30 min |

**Changes:**
```typescript
// M1: In convertBlockNoteToggleToTiptap
// Change from:
{ type: "summary", content: [...] }
{ type: "paragraph", content: [...] }
// To:
{ type: "detailsSummary", content: [...] }
{ type: "detailsContent", content: [...] }

// M4: In convertBlockNoteToTiptapNode
// Change from:
{ type: "video", ... }
{ type: "audio", ... }
// To:
{ type: "videoBlock", ... }
{ type: "audioBlock", ... }
```

**Acceptance Criteria:**
- [ ] Toggle blocks render correctly in Tiptap
- [ ] Video blocks render correctly in Tiptap
- [ ] Audio blocks render correctly in Tiptap

---

### Priority 5: Critical Migration - Ghost Rendering

| Bug | Task | Files to Modify | Est. Time |
|-----|------|-----------------|-----------|
| M6 | Add BlockNote-aware rendering in EditorGhost | `src/components/editor/EditorGhost.tsx` | 4 hours |

**Acceptance Criteria:**
- [ ] BlockNote content shows formatting in ghost mode
- [ ] Bold, italic, links, colors render correctly

---

## Phase 2: High Priority Security & Data Fixes (Week 2)

### Backend Security

| Bug | Task | Files to Modify | Est. Time |
|-----|------|-----------------|-----------|
| B8 | Restrict CORS to specific domains | `worker/src/index.ts` | 30 min |
| B11 | Add ownership verification to updateWorkspace | `src/lib/firebase/workspaces.ts` | 1 hour |
| B12 | Add ownership verification to mergeWorkspaceBack | `src/lib/firebase/workspaces.ts` | 2 hours |
| B13 | Add source ownership check to branchWorkspace | `src/lib/firebase/workspaces.ts` | 1 hour |
| B17 | Add is_public check in ViewWorkspacePage | `src/pages/ViewWorkspacePage.tsx` | 30 min |
| B18 | Sanitize URL params before DB insert | `src/pages/ImportPage.tsx` | 1 hour |

---

### Data Integrity Fixes

| Bug | Task | Files to Modify | Est. Time |
|-----|------|-----------------|-----------|
| B9 | Fix R2 deleteWorkspaceFiles prefix to include userId | `src/lib/r2/storage.ts` | 1 hour |
| B10 | Add subcollection cleanup on permanent delete | `src/lib/firebase/workspaces.ts` | 2 hours |
| B14 | Create /api/chat endpoint or update AI service | `worker/src/index.ts`, `src/lib/aiService.ts` | 3 hours |
| B19 | Add migration version counter to prevent sync overwrites | `src/store/canvasStore.ts`, `src/lib/firebase/canvasData.ts` | 4 hours |

---

### High Priority Migration Fixes

| Bug | Task | Files to Modify | Est. Time |
|-----|------|-----------------|-----------|
| M7 | Preserve wiki-link nodeId in BlockNote props | `src/lib/editor/migration.ts` | 2 hours |
| M8 | Store math LaTeX in BlockNote props | `src/lib/editor/migration.ts` | 2 hours |
| M12 | Implement column layout preservation | `src/lib/editor/migration.ts` | 4 hours |
| M13 | Add explicit contentVersion field for format detection | `src/lib/editor/migration.ts`, `src/types/canvas.ts` | 2 hours |
| M14 | Remove heading level clamp, support all 6 levels | `src/lib/editor/migration.ts` | 1 hour |

---

## Phase 3: Medium Priority Fixes (Week 3)

### Backend Medium Priority

| Bug | Task | Est. Time |
|-----|------|-----------|
| B20 | Add error handling to signOut flow | 1 hour |
| B21 | Fix race condition in Dashboard workspace loading | 2 hours |
| B22 | Clear _skipSyncTimeout on unmount | 30 min |
| B23 | Limit history snapshots to prevent memory growth | 2 hours |
| B24 | Add NaN validation in real-time listener | 1 hour |
| B25 | Scope presence subcollection writes to user | 30 min |
| B26 | Add file size limit on R2 uploads | 1 hour |
| B27 | Add file type validation on R2 uploads | 1 hour |

---

### Admin Panel Fixes

| Bug | Task | Est. Time |
|-----|------|-----------|
| B28 | Fix getAdminStats to count nodes from subcollections | 3 hours |
| B29 | Fix getAdminUsers to count workspaces per user | 2 hours |
| B30 | Fix getAdminWorkspaces to resolve owner names | 2 hours |
| B31 | Add subcollection cleanup to admin deleteUser | 2 hours |
| B32 | Fix getAdminStorage key path parsing | 1 hour |

---

### Migration Medium Priority

| Bug | Task | Est. Time |
|-----|------|-----------|
| M10 | Fix initialContentApplied to reset on content change | 1 hour |
| M11 | Fix HybridEditor fallback race condition | 3 hours |
| M15 | Create custom BlockNote callout block spec | 6 hours |
| M16 | Preserve inline images during migration | 2 hours |
| M17 | Preserve mention metadata | 2 hours |
| M18 | Preserve file block metadata | 2 hours |
| M19 | Preserve mermaid diagram type | 1 hour |
| M20 | Improve table column count inference | 2 hours |
| M21 | Add migration handlers for 6 custom block types | 6 hours |

---

## Phase 4: Low Priority & Cleanup (Week 4)

| Bug | Task | Est. Time |
|-----|------|-----------|
| B34 | Show sendVerification errors | 30 min |
| B35 | Reset LoginPage loading state on navigation failure | 30 min |
| B36 | Remove unused toast import | 5 min |
| B37 | Add userId parameter to deleteWorkspaceFiles | 30 min |
| B38 | Remove or replace DataConnect example schema | 1 hour |
| B40 | Clear cursors in resetState | 30 min |
| B41 | Fix HMR fallback signOut | 30 min |
| B42 | Fix variable shadowing in WorkspacePage | 15 min |
| B43 | Remove or use UUID_LENIENT_RE | 15 min |
| M22 | Add schema validation to migration output | 4 hours |
| M23 | Fix task checkbox state extraction | 1 hour |
| M24 | Add bidirectional file type migration | 2 hours |
| M25 | Prevent paste content re-trigger on reload | 1 hour |
| M26 | Remove LectureNotesNode forceTiptap | 30 min |
| M27 | Fix error fallback to not replace user content | 2 hours |
| M28 | Normalize color values between formats | 2 hours |
| M29 | Fix BlockNote onChange first emission skip | 1 hour |
| M30 | Implement _v1Backup restoration | 2 hours |
| M31 | Add error handling for async extension loading | 1 hour |
| M32 | Add comprehensive migration test coverage | 8 hours |
| M33 | Fix table header detection logic | 1 hour |
| M34 | Fix BlockNote paragraph textAlign compatibility | 1 hour |
| M35 | Add NaN validation in ViewWorkspacePage | 30 min |

---

## Phase 5: Infrastructure & Testing (Weeks 5-6)

### Schema Validation System

Create shared schema constants for node type names:

```typescript
// src/lib/editor/schema.ts
export const TIPTAP_NODE_TYPES = {
  VIDEO: 'videoBlock',
  AUDIO: 'audioBlock',
  TOGGLE_SUMMARY: 'detailsSummary',
  TOGGLE_CONTENT: 'detailsContent',
  CALLOUT: 'calloutBlock',
  MATH: 'mathBlock',
  MERMAID: 'mermaidBlock',
  WIKI_LINK: 'wikiLink',
  // ... etc
} as const;

export const BLOCKNOTE_NODE_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  // ... etc
} as const;
```

### Migration Validation Layer

```typescript
// src/lib/editor/validation.ts
export function validateTiptapOutput(nodes: TiptapNode[]): ValidationResult {
  const errors: string[] = [];
  
  for (const node of nodes) {
    if (node.type === 'listItem' && !isInsideList(node)) {
      errors.push('listItem must be inside bulletList or orderedList');
    }
    // ... more validations
  }
  
  return { valid: errors.length === 0, errors };
}
```

### Test Coverage

| Test Type | Target | Est. Time |
|-----------|--------|-----------|
| Migration unit tests | All 35 block types | 8 hours |
| Round-trip fidelity tests | 10 key block types | 4 hours |
| Security endpoint tests | All Worker endpoints | 4 hours |
| Firestore rule tests | All collections | 4 hours |

---

## Phase 6: Advanced Improvements (Weeks 7-8)

### Server-side Migration

Move migration logic to Cloudflare Worker to eliminate client-side format discrepancies:

```typescript
// worker/src/migration.ts
export async function migrateContent(
  content: any,
  fromVersion: number,
  toVersion: number
): Promise<any> {
  // Server-side migration eliminates race conditions
}
```

### Presigned URL System

Replace direct R2 client access with Worker-generated presigned URLs:

```typescript
// worker/src/index.ts
app.post('/api/r2/presign-upload', async (c) => {
  // Validate auth token
  // Generate presigned URL with expiration
  // Return URL to client
});
```

### Rate Limiting

Add rate limiting to all Worker endpoints:

```typescript
// worker/src/rateLimit.ts
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, limit: number): boolean {
  // Implementation
}
```

---

## Implementation Schedule

| Week | Focus | Bugs Fixed |
|------|-------|------------|
| 1 | Critical Security & Migration | B1-B7, M1-M6 (13 bugs) |
| 2 | High Priority Security & Data | B8-B19, M7-M14 (22 bugs) |
| 3 | Medium Priority | B20-B32, M15-M21 (24 bugs) |
| 4 | Low Priority & Cleanup | B34-B43, M22-M35 (19 bugs) |
| 5-6 | Infrastructure & Testing | Schema system, validation, tests |
| 7-8 | Advanced Improvements | Server migration, presigned URLs |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing data during migration fixes | Data loss | Add migration backup before changes |
| Security fix breaks legitimate use cases | Feature regression | Add feature flags for gradual rollout |
| Performance impact from validation layer | UX degradation | Make validation async and non-blocking |
| Undiscovered dependencies on current behavior | Unforeseen bugs | Run full test suite after each phase |

---

## Verification Checklist

After completing all fixes:

- [ ] Run `npm run lint` - no errors
- [ ] Run `npm run typecheck` - no type errors
- [ ] Run `npm run test` - all tests pass
- [ ] Manual test: Create toggle block in BlockNote, verify in Tiptap
- [ ] Manual test: Create list in BlockNote, verify in Tiptap
- [ ] Manual test: Upload file, verify presigned URL flow
- [ ] Manual test: Call Worker endpoint without auth - should fail
- [ ] Manual test: Call /api/urlMetadata with private IP - should fail
- [ ] Verify R2 credentials not in client bundle (check build output)
- [ ] Verify Firestore rules restrict user profile access
