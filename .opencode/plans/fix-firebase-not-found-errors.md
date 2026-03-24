# Plan: Fix Firebase "No document to update" Errors

## Problem
When a node is deleted (either locally or on another device), pending `updatePosition` operations for that node continue to queue and fail during sync replay. The error is not properly recognized, causing:
- Repeated console errors
- Warning toast messages for every retry attempt
- Operations sitting in the queue indefinitely until the 30-day stale purge

## Root Cause
In `src/lib/cache/canvasCache.ts:720-749`, the error handling doesn't recognize Firestore's `not-found` error. The error message "No document to update: ..." falls through to the catch-all "Unknown error" case.

## Solution
Add explicit handling for `not-found` errors in the `replayPendingOps` function's catch block.

### File: `src/lib/cache/canvasCache.ts`
**Location**: Line 728 (after the `invalid-argument` check, before network/auth check)

**Add this code block**:
```typescript
// Document no longer exists (e.g., node/edge was deleted elsewhere)
if (err?.code === 'not-found' || err?.message?.includes('No document to update')) {
  console.warn('[sync] Removing op for deleted document:', op.type, err?.message);
  await removePendingOp(op.id);
  purged++;
  continue;
}
```

### Rationale
- The operation targets a document that no longer exists in Firestore
- Retrying is pointless — the document must be recreated first
- No toast warning needed (the deletion was intentional, not an error)
- Silent removal is appropriate since the sync state is now consistent

## Testing
1. Run `npm run lint` to verify code style
2. Run `npm run test` to verify no regressions
3. Manual test: Delete a node, move another node, verify no error toast appears and the pending op is silently removed
