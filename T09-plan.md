# T09 - Immersive Background System Implementation Plan

> 沉浸式背景系统实施计划

## Overview

**Theme**: T09 Immersive Background System
**Version**: v0.2.5
**Status**: Foundation done, advanced features pending
**Goal**: Complete dynamic backgrounds, video support, IndexedDB storage, and visual effects

---

## Current State Analysis

### ✅ Already Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| BackgroundContext | ✅ | Global + per-chat backgrounds, fallback chain |
| BackgroundLayer | ✅ | CSS rendering with blur/opacity/overlay |
| BackgroundSettingsModal | ✅ | 3-tab UI (presets, upload, adjust) |
| themes.js | ✅ | 139+ preset backgrounds, 12 categories |
| Character integration | ✅ | Links to persona defaultBackgroundId |
| Smooth transitions | ✅ | Framer Motion 0.5s fade animations |

### ❌ Missing for Complete T09

| Feature | Priority | Complexity |
|---------|----------|------------|
| IndexedDB image storage | P0 | Medium |
| Image compression | P0 | Medium |
| Dynamic CSS backgrounds | P1 | High |
| Video backgrounds | P1 | Medium |
| Time-based switching | P2 | Low |
| Background sharing | P2 | Low |

---

## Phase 1: Storage Infrastructure (P0)

### 1.1 IndexedDB Migration

**Problem**: Current base64 in localStorage = 33% size increase + 5-10MB limit

**Implementation**:
- Create `src/services/storage/ImageStorageService.js`
- Use IndexedDB for storing uploaded images
- Store only image IDs in localStorage, actual data in IndexedDB
- Migrate existing base64 images on first load

**Key Methods**:
```javascript
// ImageStorageService
async saveImage(id, base64Data) → returns imageId
async getImage(id) → returns base64Data
async deleteImage(id)
async migrateFromLocalStorage() // One-time migration
```

**Files to Create**:
- `src/services/storage/ImageStorageService.js` (new)

**Files to Modify**:
- `src/features/background/BackgroundContext.jsx` - Use ImageStorageService for custom images
- `src/features/background/BackgroundSettingsModal.jsx` - Async image loading

### 1.2 Image Compression

**Implementation**:
- Compress images before storage
- Target: max 1920x1080 resolution
- Quality: 0.8 for JPEG
- Use canvas-based resizing

**Files to Modify**:
- `src/features/background/BackgroundSettingsModal.jsx` - Add compression step

---

## Phase 2: Dynamic Backgrounds (P1)

### 2.1 Animated CSS Backgrounds

**New Types to Support**:
1. **Particle System** - Floating particles (dust, stars, snow)
2. **Aurora** - CSS gradient animation mimicking northern lights
3. **Rain/Snow** - CSS animation overlay
4. **Gradient Flow** - Slow-moving mesh gradients

**Implementation**:
- Create `src/features/background/components/DynamicBackground.jsx`
- Support `type: 'animated'` in background config
- CSS-only animations (no Canvas/WebGL for performance)

**Files to Create**:
- `src/features/background/components/DynamicBackground.jsx`
- `src/features/background/styles/animations.css`

**Files to Modify**:
- `src/features/background/BackgroundLayer.jsx` - Render DynamicBackground when type is 'animated'
- `src/features/background/themes.js` - Add animated background presets

### 2.2 Video Backgrounds

**Implementation**:
- Support `type: 'video'` in background config
- Formats: MP4, WebM
- Auto-loop, muted, no controls
- Poster image for loading state

**Files to Modify**:
- `src/features/background/BackgroundLayer.jsx` - Add video element support
- `src/features/background/BackgroundSettingsModal.jsx` - Video upload/URL input

---

## Phase 3: Enhanced Features (P2)

### 3.1 Time-Based Auto-Switching

**Implementation**:
- Add `dayMode` and `nightMode` background configs
- Auto-switch based on system time or sunrise/sunset API
- Smooth crossfade transition

**Data Structure**:
```javascript
backgroundConfig: {
  type: 'preset',
  value: 'luna_starry',
  dayValue: 'luna_day',
  nightValue: 'luna_starry',
  autoSwitch: true,
  // ... blur, opacity, etc.
}
```

**Files to Modify**:
- `src/features/background/BackgroundContext.jsx` - Time-based switching logic
- `src/features/background/BackgroundSettingsModal.jsx` - Day/night selection UI

### 3.2 Background Sharing

**Implementation**:
- Export background config as JSON file
- Import from JSON
- Shareable URL (encode config in hash)

**Files to Create**:
- `src/features/background/services/BackgroundShareService.js`

**Files to Modify**:
- `src/features/background/BackgroundSettingsModal.jsx` - Add export/import buttons

### 3.3 Parallax Effect

**Implementation**:
- Subtle mouse-following parallax on background
- Configurable intensity (0-100%)
- CSS transform-based (performance-friendly)

**Files to Modify**:
- `src/features/background/BackgroundLayer.jsx` - Add parallax mouse tracking
- `src/features/background/BackgroundContext.jsx` - Add parallax setting

---

## Phase 4: Polish & Integration (P2)

### 4.1 StorageService Integration

**Issue**: Background system uses raw localStorage instead of StorageService wrapper

**Fix**:
- Migrate to use `storage.set()` / `storage.get()` for metadata
- Keep ImageStorageService for binary data

### 4.2 i18n Completion

**Issue**: Modal uses hardcoded Chinese labels

**Fix**:
- Add all background-related keys to `src/data/locales.js`
- Use `t()` function in BackgroundSettingsModal

### 4.3 Performance Optimization

**Tasks**:
- Lazy load background images (IntersectionObserver)
- Debounce blur/opacity slider updates
- Cache frequently used backgrounds

---

## Implementation Order

```
Phase 1 (Foundation)
  ├── 1.1 IndexedDB Migration
  └── 1.2 Image Compression

Phase 2 (Visual Enhancement)
  ├── 2.1 Dynamic CSS Backgrounds
  └── 2.2 Video Backgrounds

Phase 3 (Advanced Features)
  ├── 3.1 Time-Based Switching
  ├── 3.2 Background Sharing
  └── 3.3 Parallax Effect

Phase 4 (Polish)
  ├── 4.1 StorageService Integration
  ├── 4.2 i18n
  └── 4.3 Performance
```

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/services/storage/ImageStorageService.js` | IndexedDB storage for images |
| `src/features/background/components/DynamicBackground.jsx` | Animated CSS backgrounds |
| `src/features/background/styles/animations.css` | CSS animations for dynamic backgrounds |
| `src/features/background/services/BackgroundShareService.js` | Export/import/share functionality |

---

## Modified Files Summary

| File | Changes |
|------|---------|
| `BackgroundContext.jsx` | IndexedDB integration, time-based switching, parallax setting |
| `BackgroundLayer.jsx` | Video support, dynamic background rendering, parallax effect |
| `BackgroundSettingsModal.jsx` | Video upload, day/night selection, export/import buttons |
| `themes.js` | Add animated background definitions |
| `locales.js` | Add background i18n keys |

---

## Dependencies

**No new npm packages required** - All features can be implemented with:
- Native IndexedDB API
- CSS animations
- HTML5 Video element
- Existing Framer Motion for transitions

---

## Success Criteria

- [ ] Images stored in IndexedDB, not localStorage base64
- [ ] Uploaded images auto-compressed to max 1920x1080
- [ ] At least 3 animated CSS background types working
- [ ] Video backgrounds supported (MP4/WebM)
- [ ] Time-based auto-switching functional
- [ ] Background config can be exported/imported
- [ ] All UI text translated via i18n
- [ ] Smooth 60fps performance with all effects

---

## Estimated Effort

| Phase | Estimated Time |
|-------|---------------|
| Phase 1 | 4-6 hours |
| Phase 2 | 6-8 hours |
| Phase 3 | 4-6 hours |
| Phase 4 | 2-4 hours |
| **Total** | **16-24 hours** |
