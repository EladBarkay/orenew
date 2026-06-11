# MagNet Implementation Tasks (v0.1 → v1.0)

## Overview

This document details all tasks from Tier 1-3 to take MagNet from feature-complete (v0.1) to production-ready (v1.0).

**Definition of Done (v1.0)**:
- Fast, responsive UI
- Preview generation: < 500ms
- **Export speed: 0.1 seconds per photo** (0.2s max for 2-photo canvas)
- All critical bugs fixed
- 80%+ unit test coverage on core modules
- Zero crashes in end-to-end testing

---

## Tier 1: Critical Fixes & Polish (Week 1)

### Task 1.1: Canvas Preset Auto-Migration

**Purpose**: Fix white border artifact on existing presets by migrating `margin_px: 40 → 0`

**Files Modified**:
- `src-tauri/src/project/persistence.rs` — Load hook to migrate presets
- `src/components/CanvasPresetManager.tsx` — Show migration message

**Scope**:
1. On `load_event()`, check all canvas presets for `margin_px == 40`
2. Auto-update to `margin_px = 0`
3. Mark migration in magnet.json (e.g., `"migrated_margin": true`)
4. Save updated event
5. Show toast/notification: "Migrated X canvas presets to zero margin"

**Implementation Hints**:
```rust
// In persistence.rs::load_event()
if let Some(presets) = &mut event.canvas_presets {
  for preset in presets {
    if preset.margin_px == 40 && !event.migrated_margin {
      preset.margin_px = 0;
      // save event
    }
  }
}
```

**Testing**:
- Create old-style preset with margin_px=40, save event
- Restart app, verify margin_px=0 and notification shown
- Verify magnet.json persisted the change

**Estimate**: 1-2 hours

---

### Task 1.2: Canvas Preset Edit UI

**Purpose**: Allow users to edit existing canvas presets without delete/recreate

**Files Modified**:
- `src/components/CanvasPresetManager.tsx` — Add "Edit" button
- `src-tauri/src/commands/canvas_preset.rs` — Add `update_canvas_preset` command

**Scope**:
1. Add "Edit" button next to "Delete" in preset list
2. Clicking "Edit" opens `CanvasPresetForm` (modal) with populated values
3. Submit calls new command: `update_canvas_preset(id, form_data)`
4. Rust: update preset in event, save persistence
5. Frontend: close modal, refresh preset list

**Implementation Hints**:
```rust
// New command in canvas_preset.rs
#[tauri::command]
pub fn update_canvas_preset(
  state: State<AppState>,
  event_id: String,
  preset_id: String,
  form: CanvasPresetInput,
) -> Result<CanvasPreset, String> {
  // Find event, find preset, update fields, save
  // Return updated preset
}
```

**Testing**:
- Open CanvasPresetManager, click "Edit" on any preset
- Change preset name/dimensions/layout
- Submit, verify list updated
- Close app, reopen, verify changes persisted

**Estimate**: 2-3 hours

---

### Task 1.3: Dead Code Cleanup

**Purpose**: Remove unused code to improve maintainability

**Files Modified**:
- `src-tauri/src/photo/loader.rs` — Remove unused field

**Scope**:
1. Remove `pub exif_orientation: Option<Orientation>` from `LoadedPhoto` struct
2. Update any code that references this field (likely nothing, since it's unused)
3. Run `cargo clippy` to identify other warnings
4. Fix low-hanging clippy warnings (dead code, unused imports, etc.)

**Testing**:
- `cargo check` and `cargo clippy` should pass with no warnings
- Existing tests still pass

**Estimate**: 30 minutes - 1 hour

---

### Task 1.4: End-to-End Workflow Test (Manual)

**Purpose**: Validate the full app flow works without crashes or logic errors

**Scope**:
Perform this workflow and verify each step:

1. **Launch app** → Settings visible, no crash
2. **Open/Create event** → Browse to folder, event created with root_path
3. **Add batch** → Click "+ Add Batch", select folder with photos
4. **Verify batch loaded**:
   - Photos appear in gallery (thumbnails visible)
   - FS watcher fires (add new photo, see it appear)
5. **Set frame preset** → Create frame preset (landscape + portrait PNG)
6. **Set canvas preset** → Create canvas preset (e.g., 2-up 2400×1600)
7. **View preview** → Click photo, framed preview loads in <500ms
8. **Export batch**:
   - Select all photos
   - Click Export, dialog opens
   - Choose output folder
   - Export completes in < 10 seconds for 10 photos
   - Verify exported JPEGs have correct dimensions (2400×1600 or 1600×2400)
   - Open exported folder (button works)
9. **Verify watermark** (Free tier):
   - Export with free license → watermark visible in output
   - Activate pro license → export again, no watermark
10. **Print workflow**:
    - Set print quantities on photos (e.g., 2 per photo)
    - Click Print → PrintConfirmDialog opens
    - Select frame + canvas presets
    - Submit → files sent to print queue
    - Verify print_count incremented (if applicable)

**Checklist**:
- [ ] Gallery scrolls smoothly (no lag)
- [ ] Thumbnails load and cache properly
- [ ] Frame preview loads < 500ms
- [ ] Export < 10s for 10 photos (0.1s per photo)
- [ ] Exported JPEGs viewable in OS viewer
- [ ] No app crashes or hangs
- [ ] File watcher reacts to new photos
- [ ] Watermark present on free tier

**Estimate**: 2-4 hours (includes file prep and teardown)

---

## Tier 2: Feature Completeness (Week 2-3)

### Task 2.1: Frame Preset Edit UI

**Purpose**: Allow editing of frame presets (landscape/portrait paths, crop method)

**Files Modified**:
- `src/components/FramePresetDialog.tsx` — Detect edit vs create mode
- `src-tauri/src/commands/frame_preset.rs` — Add `update_frame_preset` command

**Scope**:
1. Modify FramePresetDialog to accept an optional initial preset (edit mode)
2. If editing: populate form with current values; submit calls `update_frame_preset`
3. If creating: empty form; submit calls `create_frame_preset` (existing)
4. Add edit button to frame preset list (in App.tsx sidebar, where presets shown)
5. Rust: implement `update_frame_preset(id, form_data)`
6. After edit: invalidate all framed preview caches for this preset

**Implementation Hints**:
```rust
// In frame_preset.rs
#[tauri::command]
pub fn update_frame_preset(
  state: State<AppState>,
  event_id: String,
  preset_id: String,
  form: FramePresetInput,
) -> Result<FramePreset, String> {
  // Update preset, invalidate preview cache
  // Return updated preset
}
```

**Testing**:
- Create frame preset (landscape + portrait PNGs)
- Click "Edit", change landscape PNG path
- Submit, verify gallery preview updates
- Close app, reopen, verify paths persisted

**Estimate**: 2-3 hours

---

### Task 2.2: Photo Crop/Rotation Override UI

**Purpose**: Allow photographers to manually rotate or crop photos before export

**Files Modified**:
- `src/components/PreviewPanel.tsx` — Add rotation/crop controls
- `src-tauri/src/commands/gallery.rs` — Add `update_photo_overrides` command
- `src-tauri/src/project/model.rs` — Extend `Photo::overrides` to include crop

**Scope**:
1. In PreviewPanel, add rotation buttons:
   - 90° clockwise, 90° counter-clockwise, 180°, reset
   - Store as `Photo.overrides.orientation` (already exists)
   - Persist via `update_photo_overrides` IPC
2. Add crop method toggle (center vs rule-of-thirds):
   - Dropdown: "Auto (Center)" vs "Rule of Thirds"
   - Store as `Photo.overrides.crop_method`
   - Persist
3. Real-time preview update: when user clicks rotation, framed preview refreshes
4. Verify changes reflected in framed preview < 500ms

**Implementation Hints**:
```rust
// In gallery.rs
#[tauri::command]
pub fn update_photo_overrides(
  state: State<AppState>,
  event_id: String,
  batch_id: String,
  photo_id: String,
  overrides: PhotoOverrides, // { orientation, crop_method, crop_rect }
) -> Result<Photo, String> {
  // Update photo, save event, return updated photo
}
```

**Testing**:
- Open preview, click rotate 90°, framed preview updates
- Change crop method, preview updates
- Close app, reopen, rotation persisted
- Export photo, verify rotation applied to output JPEG

**Estimate**: 3-4 hours

---

### Task 2.3: XMP Sidecar Processing

**Purpose**: Read XMP adjustments (brightness, white balance) and apply them during export/print

**Files Modified**:
- `src-tauri/src/photo/loader.rs` — Parse XMP into adjustment struct
- `src-tauri/src/photo/batch.rs` — Apply XMP adjustments before frame compositing
- `src/components/PreviewPanel.tsx` — Display XMP metadata (read-only)

**Scope**:

#### Rust Backend:
1. Extend `load_photo()` to parse XMP sidecar (if exists):
   - Look for `{photo_name}.xmp` next to photo
   - Extract adjustment values:
     - `Exif:ExposureCompensation` → brightness delta
     - `Exif:WhiteBalance` → color temperature
     - `Exif:Saturation` → saturation delta
     - `Exif:Contrast` → contrast delta
   - Store in `Photo::xmp_adjustments: Option<XmpAdjustments>`
2. In `frame_photo_for_canvas()`, after crop, before frame:
   - Apply XMP adjustments to cropped image (brightness, white balance, saturation, contrast)
   - Use `image-rs` color space operations to adjust pixel values
3. Update framed preview to also apply adjustments (so preview matches export)

#### Frontend:
1. In PreviewPanel, show XMP metadata (read-only for v1.0):
   - Display parsed adjustments: "Exposure: +0.5, White Balance: 5500K, Saturation: +10"
   - Show as read-only info section
2. Thumbnail preview should also reflect adjustments (update `useThumbnail` hook)

**Implementation Hints**:
```rust
// New struct in photo/loader.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XmpAdjustments {
  pub exposure: f32,          // EV value, e.g. +0.5
  pub white_balance_temp: u16, // Kelvin, e.g. 5500
  pub saturation: i32,         // -100 to +100
  pub contrast: i32,           // -100 to +100
}

// In loader.rs::load_photo()
let xmp_adjustments = parse_xmp_sidecar(&photo_path);
```

**Testing**:
- Create XMP sidecar with brightness adjustment
- Load photo, verify `XmpAdjustments` populated
- Generate framed preview, thumbnail, export → all show adjusted colors
- Verify PreviewPanel displays adjustment values
- Close app, reopen, adjustments still visible

**Estimate**: 4-5 hours

---

### Task 2.4: RAW Format Support

**Purpose**: Support CR2, NEF, ARW, etc. with embedded preview for gallery, full demosaicing for export

**Files Modified**:
- `src-tauri/Cargo.toml` — Add `rawloader` crate
- `src-tauri/src/photo/loader.rs` — Detect & load RAW files
- `src-tauri/src/photo/batch.rs` — Demosaic RAW on export
- `src-tauri/src/preview/thumbnail.rs` — Extract embedded JPEG for thumbnails

**Scope**:

#### Setup:
1. Add to Cargo.toml:
   ```toml
   rawloader = "0.39"
   ```

#### Rust Backend:
1. In `load_photo()`, detect file extension:
   - If JPG/PNG/TIFF → use existing `image` crate
   - If CR2/NEF/ARW/DNG → use `rawloader`
2. For RAW files, extract embedded JPEG preview:
   - RAW files contain JPEG preview → use for thumbnail (fast, 256px)
   - Store RAW file path separately for export
3. In `frame_photo_for_canvas()`:
   - If photo is RAW: load full RAW data, demosaic to sRGB
   - Apply XMP adjustments (if any)
   - Crop, apply frame, export (same pipeline as JPG)
4. Update `compute_content_hash()` to work with RAW files (use mtime + file size, skip full read)

#### Frontend:
1. Gallery thumbnail: show extracted JPEG preview (will be fast)
2. Framed preview: use existing preview pipeline (Rust-cached)
3. Update `useThumbnail` hook to handle RAW → embedded JPEG

**Implementation Hints**:
```rust
// In loader.rs
fn load_photo(path: &Path) -> Result<LoadedPhoto> {
  let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
  
  match extension.as_str() {
    "cr2" | "nef" | "arw" | "dng" => {
      // Load RAW
      let raw = rawloader::decode_file(path)?;
      let preview_jpg = raw.full_size_preview()
        .or_else(|| raw.thumbnails().first())?;
      let preview_image = image::load_from_memory(preview_jpg)?;
      Ok(LoadedPhoto { image: preview_image, /* ... */ })
    },
    _ => {
      // Existing JPG/PNG/TIFF path
    }
  }
}
```

**Testing**:
- Add CR2/NEF files to batch
- Gallery shows embedded preview (fast)
- Framed preview loads (may take longer due to demosaicing)
- Export CR2 photo, verify output is full-quality sRGB
- Verify export time still ~0.1s per photo (demosaicing is efficient)

**Estimate**: 5-6 hours

---

## Tier 3: Performance & Robustness (Week 4-5)

### Task 3.1: Unit Tests — Photo Module (Crop)

**Purpose**: Verify crop logic handles center and rule-of-thirds correctly

**Files Modified**:
- `src-tauri/src/photo/crop.rs` — Add `#[cfg(test)]` module

**Scope**:
Write 4-5 test cases:

1. **Test center crop**:
   - Input: 3000×2000px photo, 2:3 aspect ratio frame
   - Expected: 1333×2000px centered crop
   - Assert output dimensions correct

2. **Test rule-of-thirds crop**:
   - Input: 3000×2000px photo, 2:3 aspect ratio frame
   - Expected: crop offset to rule-of-thirds intersection
   - Assert offset matches expected (not centered)

3. **Test landscape photo + portrait frame**:
   - Input: 4000×2000px (landscape), 3:4 aspect (portrait)
   - Expected: crop to fit 3:4 (1500×2000px)
   - Assert portrait dimensions

4. **Test oversized frame (photo smaller than target)**:
   - Input: 800×600px photo, 1920×1440px frame
   - Expected: graceful downscaling or error
   - Assert doesn't crash

5. **Test edge case — square photo, non-square frame**:
   - Input: 2000×2000px, 16:9 frame
   - Expected: 2000×1125px crop
   - Assert correct aspect

**Implementation Hints**:
```rust
#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_center_crop_landscape_to_portrait() {
    let photo = DynamicImage::new_rgb8(3000, 2000);
    let target_ratio = (2.0, 3.0);
    let crop = compute_crop_rect(3000, 2000, target_ratio, CropMethod::Center);
    assert_eq!(crop.width, 1333);
    assert_eq!(crop.height, 2000);
  }
}
```

**Testing**:
- `cargo test --lib photo::crop` → all tests pass
- Run with coverage tool: verify crop functions 100% covered

**Estimate**: 2 hours

---

### Task 3.2: Unit Tests — Photo Module (Frame Overlay)

**Purpose**: Verify alpha compositing works correctly

**Files Modified**:
- `src-tauri/src/photo/frame.rs` — Add `#[cfg(test)]` module

**Scope**:
Write 3-4 test cases:

1. **Test frame compositing with alpha**:
   - Create small test image (100×100px)
   - Create frame PNG with transparency
   - Composite frame over image
   - Verify output dimensions correct (image + frame border)
   - Verify output is opaque (alpha blended)

2. **Test frame with full opacity (no alpha)**:
   - Frame PNG without transparency
   - Composite over image
   - Verify output matches frame (image hidden behind)

3. **Test frame compositing preserves image quality**:
   - Input JPEG, apply frame, verify output JPEG quality high (q95)

**Implementation Hints**:
```rust
#[cfg(test)]
mod tests {
  #[test]
  fn test_frame_overlay_with_transparency() {
    let image = DynamicImage::new_rgb8(800, 600);
    let frame = load_png_with_alpha("test_frame.png");
    let result = apply_frame_overlay(&image, &frame);
    assert_eq!(result.width(), 800 + 2 * FRAME_WIDTH);
    assert_eq!(result.color(), ColorType::Rgb8);
  }
}
```

**Testing**:
- Create test PNG with transparency
- `cargo test --lib photo::frame` → all tests pass

**Estimate**: 2 hours

---

### Task 3.3: Unit Tests — License Module

**Purpose**: Verify license key validation handles valid/invalid/expired keys

**Files Modified**:
- `src-tauri/src/license/validator.rs` — Add `#[cfg(test)]` module

**Scope**:
Write 6-8 test cases:

1. **Test valid free tier key**:
   - Generate key with HMAC for free tier, today's date
   - Validate, assert tier=free, expiry=today

2. **Test valid pro tier key**:
   - Generate key for pro tier, future date
   - Validate, assert tier=pro, expiry correct

3. **Test expired key**:
   - Generate key with past expiry date
   - Validate, assert error "key expired"

4. **Test invalid key (bad HMAC)**:
   - Corrupt HMAC portion
   - Validate, assert error "invalid key"

5. **Test key format validation**:
   - Missing prefix "MAGNET-"
   - Validate, assert error "invalid format"

6. **Test case insensitivity**:
   - Key with mixed case
   - Validate, assert works (or fails gracefully)

7. **Test boundary: key expires today at midnight**:
   - Edge case for expiry comparison
   - Verify behavior (allow or reject?)

**Implementation Hints**:
```rust
#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_valid_free_tier_key() {
    let secret = "test_secret";
    let key = generate_key("user@example.com", "2025-12-31", "free", secret);
    let result = validate_key(&key, secret);
    assert!(result.is_ok());
    assert_eq!(result.unwrap().tier, Tier::Free);
  }

  #[test]
  fn test_expired_key() {
    let secret = "test_secret";
    let key = generate_key("user@example.com", "2020-01-01", "pro", secret);
    let result = validate_key(&key, secret);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("expired"));
  }
}
```

**Testing**:
- `cargo test --lib license::validator` → all tests pass
- Verify no hardcoded secret in tests (use mock/fixture)

**Estimate**: 2-3 hours

---

### Task 3.4: Unit Tests — Canvas Composition

**Purpose**: Verify grid layout and photo placement work correctly

**Files Modified**:
- `src-tauri/src/canvas/compositor.rs` — Add `#[cfg(test)]` module

**Scope**:
Write 4-5 test cases:

1. **Test 1-up canvas (single photo)**:
   - Input: 1 framed photo (800×600px), 1-up preset
   - Expected: canvas = 800×600px
   - Assert photo placed at (0, 0)

2. **Test 2-up canvas (2 photos horizontal)**:
   - Input: 2 framed photos (800×600px each), 2-up preset (gaps between)
   - Expected: canvas dimensions = 1600×600px + margin
   - Assert photos at correct positions

3. **Test 4-up canvas (2×2 grid)**:
   - Input: 4 framed photos, 2×2 preset
   - Expected: 2×2 grid layout with margins
   - Assert all photos positioned correctly

4. **Test watermark compositing (free tier)**:
   - Input: canvas from 2.up, free license
   - Expected: diagonal stripe watermark applied
   - Assert watermark visible (sample pixel color changed)

5. **Test no watermark (pro tier)**:
   - Input: same canvas, pro license
   - Expected: no watermark
   - Assert output = input (pixel-perfect match)

**Implementation Hints**:
```rust
#[cfg(test)]
mod tests {
  #[test]
  fn test_2up_horizontal_layout() {
    let photo1 = DynamicImage::new_rgb8(800, 600);
    let photo2 = DynamicImage::new_rgb8(800, 600);
    let preset = CanvasPreset { photos_per_canvas: 2, cols: 2, rows: 1, width_px: 1600, height_px: 600, .. };
    
    let canvas = compose_one(&[photo1, photo2], &preset);
    assert_eq!(canvas.width(), 1600);
    assert_eq!(canvas.height(), 600);
  }

  #[test]
  fn test_watermark_applied_on_free_tier() {
    let canvas = DynamicImage::new_rgb8(1600, 600);
    let result = apply_watermark(&canvas, Tier::Free);
    
    // Sample a pixel and verify watermark stripe visible
    let pixel = result.get_pixel(100, 100);
    assert_ne!(pixel, [255, 255, 255]); // Not pure white (watermark applied)
  }
}
```

**Testing**:
- `cargo test --lib canvas::compositor` → all tests pass
- Visually inspect test output images (save to /tmp for inspection)

**Estimate**: 2-3 hours

---

### Task 3.5: Progress & Error Tracking

**Purpose**: Improve export/print feedback with per-photo error logs and retry

**Files Modified**:
- `src/components/ExportDialog.tsx` — Show error list & retry button
- `src-tauri/src/commands/batch.rs` — Collect errors per photo

**Scope**:

#### Rust Backend:
1. Modify `export_batch` return type to include error list:
   ```rust
   pub struct ExportResult {
     pub success_count: usize,
     pub error_count: usize,
     pub errors: Vec<ExportError>, // { photo_id, error_message }
   }
   ```
2. On error during processing, capture error + photo_id, continue (don't panic)
3. Return all errors to frontend

#### Frontend:
1. In ExportDialog result screen, show:
   - Summary: "Exported 48/50 photos"
   - Expandable error section: "2 errors" → list photo names + error messages
2. Add "Retry" button:
   - Re-export only failed photos
   - Re-run with same settings
3. Add "Save Error Log" button:
   - Write errors to `{output_folder}/export_errors.txt`
   - Include timestamp, photo names, error messages

**Implementation Hints**:
```rust
// In batch.rs
pub struct ExportError {
  pub photo_id: String,
  pub photo_path: String,
  pub error: String, // e.g., "Corrupted JPEG", "Frame not found"
}

// In export_batch loop:
match frame_photo_for_canvas(...) {
  Ok(framed) => { /* export */ success_count += 1; },
  Err(e) => {
    errors.push(ExportError {
      photo_id: photo.id.clone(),
      photo_path: photo.path.clone(),
      error: e.to_string(),
    });
  }
}
```

**Testing**:
- Corrupt one JPEG in batch
- Export → error captured, logged
- Verify error message clear (e.g., "JPEG decode failed")
- Click retry → re-export failed photo
- Verify error log file created with content

**Estimate**: 3 hours

---

### Task 3.6: Memory Optimization & Monitoring

**Purpose**: Ensure 100+ photo batches don't exceed 500MB memory peak

**Files Modified**:
- `src-tauri/src/commands/batch.rs` — Add memory tracking
- `src/components/SettingsDialog.tsx` — Show memory stats (optional debug)

**Scope**:

#### Benchmarking:
1. Create test batch: 100 JPEGs (3000×2000px each, ~2.5MB each)
2. Export batch, monitor memory via OS task manager or `htop`
3. Capture:
   - Peak memory during export
   - Average memory per concurrent photo
4. If peak > 500MB: investigate and optimize

#### Potential Optimizations (if needed):
1. **Reduce rayon concurrency**: currently 4 concurrent; try 2-3
2. **Stream thumbnails**: generate & cache one at a time (current: all at once)
3. **Use memory pools**: pre-allocate buffers, reuse across photos
4. **Lazy-load EXIF**: read only if needed (current: always)

#### Optional Debug UI:
1. In SettingsDialog, add collapsible "Debug" section:
   - Show peak memory from last export
   - Show current memory usage
   - Button to force garbage collection (Tauri memory stats)

**Testing**:
- Run benchmark: 100 photos
- Verify peak memory < 500MB
- Run 5+ times to confirm consistency
- Document results in PERFORMANCE_TARGETS.md

**Estimate**: 2-3 hours (benchmark may be slow)

---

### Task 3.7: Theme / Dark Mode

**Purpose**: Add UI theme toggle (light/dark) for user preference

**Files Modified**:
- `src/App.tsx` — Add theme state + context
- `src/components/SettingsDialog.tsx` — Add theme toggle
- `src/index.css` — Add Tailwind dark mode styles
- All component files — Use `dark:` Tailwind classes

**Scope**:

#### Frontend:
1. Create theme context (or use localStorage + useState):
   - Theme options: "light", "dark", "system"
2. On app load:
   - Read localStorage for user preference
   - If "system": detect OS dark mode (Tauri has API)
3. In SettingsDialog:
   - Radio buttons: Light / Dark / Auto (system)
   - Save choice to localStorage
4. Apply theme:
   - Add `dark` class to root `<html>` element
   - Tailwind handles rest (via `dark:` prefix)

#### Styling:
1. Audit current components for dark mode:
   - Gallery background
   - Cards, buttons
   - Text colors
   - Input fields
2. Add Tailwind `dark:` equivalents:
   ```jsx
   <div className="bg-white dark:bg-gray-900">
   ```

**Implementation Hints**:
```tsx
// In App.tsx
const [theme, setTheme] = useState<"light" | "dark" | "system">(
  () => localStorage.getItem("theme") || "system"
);

useEffect(() => {
  const isDark = theme === "dark" || 
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  
  document.documentElement.classList.toggle("dark", isDark);
  localStorage.setItem("theme", theme);
}, [theme]);
```

**Testing**:
- Toggle theme in SettingsDialog
- Verify all UI elements adapt (text, backgrounds, borders)
- Close app, reopen, verify theme persisted
- Test "system" mode (if dark mode enabled on OS, app follows)

**Estimate**: 2-3 hours

---

## Implementation Schedule

| Tier | Tasks | Estimate | Week(s) |
|------|-------|----------|---------|
| **1** | 1.1-1.4 | 8-10h | 1 |
| **2** | 2.1-2.4 | 16-20h | 2-3 |
| **3** | 3.1-3.7 | 17-21h | 2-2.5 |
| **Total** | **14 tasks** | **41-51h** | **5-6.5 weeks** |

---

## Git Commit Convention

Each task (or task group) gets one logical commit following conventional commit format:

| Tier | Task | Commit Type | Example Message |
|------|------|-------------|-----------------|
| 1 | 1.1 + 1.2 | `fix:` | `fix: auto-migrate canvas presets and add edit UI` |
| 1 | 1.3 | `refactor:` | `refactor: remove dead code from photo loader` |
| 2 | 2.1 | `feat:` | `feat: add frame preset edit UI` |
| 2 | 2.2 | `feat:` | `feat: add photo crop and rotation overrides` |
| 2 | 2.3 | `feat:` | `feat: implement XMP sidecar processing` |
| 2 | 2.4 | `feat:` | `feat: add RAW format support (CR2, NEF, ARW, DNG)` |
| 3 | 3.1-3.4 | `test:` | `test: add unit tests for photo, license, canvas` |
| 3 | 3.5 | `refactor:` | `refactor: add progress tracking and error logs` |
| 3 | 3.6 | `refactor:` | `refactor: optimize memory usage for large batches` |
| 3 | 3.7 | `feat:` | `feat: add dark mode theme toggle` |

---

## Definition of Done (v1.0)

✅ **All Tier 1-3 tasks completed**
- [ ] Canvas preset auto-migration working
- [ ] Canvas/frame preset editing available
- [ ] Photo crop/rotation overrides implemented
- [ ] XMP sidecar processing functional
- [ ] RAW format support working
- [ ] Unit tests for core modules (80%+ coverage)
- [ ] Error tracking & retry in export
- [ ] Memory optimized for 100+ photos
- [ ] Dark mode theme available

✅ **Performance targets met**
- [ ] Export speed: 0.1s per photo (0.2s per 2-photo canvas)
- [ ] Preview generation: < 500ms
- [ ] Gallery scroll: smooth (16ms frames)
- [ ] Thumbnail load: < 200ms (cached)

✅ **Quality gates**
- [ ] Zero crashes in e2e testing
- [ ] All critical bugs fixed
- [ ] UI responsive under load

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| RAW demosaicing slow | Benchmark early (task 2.4); may reduce quality or concurrency |
| XMP parsing fragile | Use established library; handle missing/corrupt XMP gracefully |
| Export still < 0.1s target | Profile with flamegraph; may need rayon tuning or memory pooling |
| Memory spike on 100+ photos | Monitor during task 3.6; reduce concurrency if needed |
| Dark mode CSS incomplete | Audit all components; test before merge |

