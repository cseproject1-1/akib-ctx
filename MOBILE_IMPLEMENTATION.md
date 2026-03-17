# CtxNote Mobile UI/UX Implementation

## Overview

This implementation adds a **completely separate mobile UI/UX** to CtxNote that:
- Is fully touch-friendly and optimized for mobile devices
- Runs on `/mobile-mode/*` routes separate from desktop
- Auto-detects mobile devices and redirects automatically
- Preserves all desktop UI/UX without any modifications
- Uses the same backend (Firebase), sync system, and IndexedDB cache

## Architecture

### File Structure

```
src/mobile/
├── components/
│   ├── MobileRouteGuard.tsx    # Auto-detect and redirect logic
│   └── MobileNodeContextMenu.tsx # Bottom-sheet context menu
├── hooks/
│   ├── useDeviceDetect.ts      # Device detection (mobile/tablet/desktop)
│   ├── useMobileSync.ts        # Reuses existing sync infrastructure
│   └── useNetworkStatus.ts     # Offline indicator
├── layout/
│   ├── MobileLayout.tsx        # Main container with header/bottom-nav
│   ├── MobileHeader.tsx        # Header with back/menu actions
│   ├── MobileBottomNav.tsx     # Bottom navigation tabs
│   └── MobileDrawer.tsx        # Slide-out menu with settings
└── pages/
    ├── MobileDashboard.tsx     # Workspace list with touch gestures
    ├── MobileCanvas.tsx        # Touch-optimized infinite canvas
    ├── MobileSettings.tsx      # Settings with theme and desktop switch
    └── MobileSearch.tsx        # Full-screen search with recent history
```

## Key Features

### 1. Auto-Detection & Redirect

- **Detection Method**: Checks user agent and screen width (< 768px = mobile)
- **Redirect Logic**: On every page load, mobile devices redirect to `/mobile-mode`
- **User Control**: Mobile users can switch to desktop view via settings (stored in localStorage)

### 2. Touch-Optimized UI

- **Bottom Navigation**: 4 tabs (Home, Canvas, Search, Settings) - native mobile pattern
- **Bottom Sheets**: Context menus slide up from bottom
- **Long-Press Gestures**: Replace right-click for node actions
- **Pinch-to-Zoom**: Native ReactFlow pinch zoom support
- **Pull-to-Refresh**: Workspace list refresh (implemented)

### 3. Layout Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| MobileLayout | Main container | Header, content area, bottom nav, drawer |
| MobileHeader | Top navigation | Back button, title, menu trigger |
| MobileBottomNav | Navigation tabs | Home, Canvas, Search, Settings |
| MobileDrawer | Slide-out menu | User profile, theme, desktop switch |

### 4. Pages

#### MobileDashboard
- Vertical scrolling workspace list
- Search bar with category filtering
- FAB (Floating Action Button) for creating workspaces
- Swipe gestures for actions (delete, favorite)

#### MobileCanvas
- ReactFlow with touch-optimized settings:
  - `zoomOnPinch: true` - pinch to zoom
  - `nodeDragThreshold: 10` - prevents accidental drags
  - `panOnScroll: false` - uses touch gestures instead
- Zoom controls (zoom in/out, fit view)
- Long-press for node context menu

#### MobileSettings
- Theme toggle (light/dark/system)
- "Switch to Desktop" option (stored in localStorage)
- Sign out functionality
- Cache clearing option

#### MobileSearch
- Full-screen search modal
- Recent searches history
- Filter by nodes/workspaces

### 5. Offline Support

- Uses existing `canvasCache.ts` system
- IndexedDB caching works identically to desktop
- Offline indicator banner when disconnected
- Pending operations sync when back online

## Routing

### Desktop Routes (unchanged)
- `/` - Dashboard
- `/workspace/:id` - Canvas
- `/admin` - Admin panel
- `/import` - Import page

### Mobile Routes
- `/mobile-mode` - Mobile dashboard
- `/mobile-mode/workspace/:id` - Mobile canvas
- `/mobile-mode/settings` - Mobile settings
- `/mobile-mode/search` - Mobile search

## State Management

The mobile UI **reuses all existing Zustand stores**:
- `canvasStore.ts` - Canvas nodes, edges, workspace state
- `settingsStore.ts` - Theme, preferences
- `AuthContext` - Authentication (same as desktop)

This ensures **data consistency** and prevents any data corruption.

## Sync & Backend

Mobile uses the **exact same sync infrastructure** as desktop:
- Firebase Firestore for server data
- IndexedDB (via `canvasCache.ts`) for offline caching
- Pending operations queue for offline writes
- Real-time subscriptions for multi-user sync

## Key Implementation Details

### Device Detection

```typescript
// src/mobile/hooks/useDeviceDetect.ts
const MOBILE_BREAKPOINT = 768;
const isMobile = width < MOBILE_BREAKPOINT || /Mobi|Android/i.test(userAgent);
```

### Auto-Redirect

```typescript
// App.tsx routes - mobile routes added alongside desktop
<Route path="/mobile-mode" element={<MobileDashboard />} />
<Route path="/mobile-mode/workspace/:id" element={<MobileCanvas />} />
```

### Touch Gesture Handling

```typescript
// MobileCanvas.tsx
<ReactFlow
  zoomOnPinch={true}        // Pinch to zoom
  nodeDragThreshold={10}    // Prevent accidental drags
  panOnDrag={true}          // Pan with one finger
  zoomOnScroll={true}       // Scroll to zoom
/>
```

## How It Works

1. **User visits the site on mobile**
   - `useDeviceDetect` detects mobile/tablet device
   - Redirects to `/mobile-mode` automatically

2. **User navigates to workspace**
   - Clicks workspace card
   - Loads `/mobile-mode/workspace/:id`
   - Canvas loads with touch-optimized ReactFlow

3. **User interacts with canvas**
   - Pinch to zoom
   - Pan with one finger
   - Long-press node for context menu
   - FAB to add new nodes

4. **User wants desktop experience**
   - Opens drawer menu
   - Clicks "Switch to Desktop"
   - Stores preference in localStorage
   - Redirects to desktop routes

## Safety & Data Integrity

### No Desktop Modifications
- All desktop routes remain unchanged
- All desktop components remain unchanged
- No changes to desktop state management
- No changes to Firebase backend structure

### Data Safety
- Uses same IndexedDB cache system
- Uses same Firebase sync system
- Pending operations queue ensures no data loss
- Offline mode works identically to desktop

### Testing Checklist
- [ ] Desktop routes work unchanged
- [ ] Desktop UI appears identical
- [ ] Mobile auto-redirects correctly
- [ ] Mobile UI is touch-optimized
- [ ] All features work on mobile
- [ ] Offline mode works on mobile
- [ ] Sync works on mobile
- [ ] Data integrity maintained

## Device Support

### Tested Devices (Recommended)
- iPhone 12/13/14/15 (iOS Safari)
- iPad (tablet mode)
- Android phones (Chrome)
- Android tablets

### Breakpoints
- Mobile: < 768px (phones)
- Tablet: 768px - 1024px
- Desktop: > 1024px

## Browser Compatibility

- iOS Safari 14+
- Chrome 90+
- Firefox 90+
- Edge 90+

## Future Enhancements

1. **Gesture Library**: Add `@use-gesture/react` for advanced gestures
2. **Virtualization**: Add `react-window` for large node lists
3. **Code Splitting**: Lazy load mobile components
4. **PWA**: Add service worker for offline installation
5. **Animations**: Add more framer-motion animations
6. **Accessibility**: Add ARIA labels and screen reader support

## Troubleshooting

### Desktop shows mobile UI
- Clear localStorage: `localStorage.removeItem('useDesktopMode')`

### Mobile doesn't auto-redirect
- Check browser console for errors
- Verify `useDeviceDetect` detects device correctly

### Data not syncing
- Check network connection
- Verify IndexedDB has data
- Check Firebase authentication status

---

**Implementation Status**: ✅ Phase 1-8 Complete (Core Infrastructure)
**Next Steps**: Performance optimization, PWA configuration, device testing
