# Mobile UI Quick Reference

## Directory Structure
```
src/mobile/
├── components/     (5 files)
├── hooks/          (3 files)
├── layout/         (4 files)
├── pages/          (4 files)
└── index.ts        (1 file)
```

## Key Files

| File | Purpose |
|------|---------|
| `useDeviceDetect.ts` | Detects mobile/tablet/desktop |
| `MobileLayout.tsx` | Main container with header & bottom nav |
| `MobileDashboard.tsx` | Workspace list with search & FAB |
| `MobileCanvas.tsx` | Touch-optimized infinite canvas |
| `MobileSettings.tsx` | Theme toggle & desktop switch |

## Mobile Routes

| Route | Page |
|-------|------|
| `/mobile-mode` | Dashboard |
| `/mobile-mode/workspace/:id` | Canvas |
| `/mobile-mode/settings` | Settings |
| `/mobile-mode/search` | Search |

## Touch Gestures

| Gesture | Action |
|---------|--------|
| 1-finger drag | Pan canvas |
| Pinch | Zoom canvas |
| Long-press node | Open context menu |
| Pull down | Refresh dashboard |
| Swipe back | Navigate back |

## Theme System

- Uses same localStorage key as desktop: `crxnote-theme`
- Supports: `light` and `dark`
- Desktop theme = mobile theme (shared state)

## Auto-Redirect

- Mobile devices auto-redirect to `/mobile-mode`
- Stored preference: `localStorage.getItem('useDesktopMode')`
- Reset: `localStorage.removeItem('useDesktopMode')`

## Commands

```bash
# Development
npm run dev

# Lint check
npm run lint

# Build
npm run build
```

## Files to Check

- `src/App.tsx` - Mobile routes added
- `src/mobile/index.ts` - Public API exports
- `MOBILE_IMPLEMENTATION.md` - Full documentation
- `MOBILE_UI_FINAL.md` - Final summary

## Troubleshooting

**Desktop shows mobile UI?**
- Clear localStorage: `localStorage.removeItem('useDesktopMode')`

**No auto-redirect?**
- Check mobile device detection
- Verify browser console for errors

**Data not syncing?**
- Check network connection
- Verify Firebase authentication
