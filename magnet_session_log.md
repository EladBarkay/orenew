# MagNet — Session Mission Log

---

## ✅ What Was Done

### Bug Fixes

| Issue | Fix Applied |
|---|---|
| `tauri` not recognized on Windows | Changed `package.json` script to `"tauri": "npx tauri"` |
| UUID crash on preset creation | Added `FramePresetInput` / `CanvasPresetInput` structs without `id`; removed `id: ""` from frontend invoke calls |
| Orientation detection | Removed EXIF-based logic entirely — now uses pixel dimensions only (`width >= height → Landscape`) |
| FS watcher not pushing updates | Rewrote `FsWatcher` to emit Tauri `"folder-changed"` events; frontend listens via `useRef` stable-closure pattern and calls `refresh_batch` IPC; `merge_photos()` preserves `print_count` + overrides for unchanged photos, resets for changed, drops deleted |
| Export extremely slow (~2 min / 2 photos) | Added `frame_photo_for_canvas()` — crops photo then resizes to slot dimensions **before** frame compositing; pre-resizes both frame PNGs to slot size once before the rayon loop; compositing now works on ~1–2 MP instead of ~20 MP (~10–20× speedup) |
| White border around exported photos | **Partially fixed** — default `margin_px` in `CanvasPresetForm` changed from 40 → 0 for new presets. Existing saved presets in `magnet.json` still have `margin_px: 40` and will still show a white border. User must delete and recreate their canvas preset, or the app needs a way to edit existing presets / the saved JSON needs to be patched manually. |
| "Open folder" button broken in export result | Was calling nonexistent `invoke("open_path", ...)`; replaced with `openPath` from `@tauri-apps/plugin-opener` |

---

### Features Added

- **Multi-batch support** — `add_batch` command + sidebar "+ Add" button; each batch is an independent folder scan
- **Delete event** — `delete_event` command + trash icon in toolbar with confirmation dialog
- **Delete batch** — `delete_batch` command + hover-revealed trash icon per batch item; Rust unwatches the folder; files are never touched
- **Canvas preset margin default** — new presets now default to `margin_px: 0`; **existing presets are unaffected** (still need edit/delete-recreate to fix)
- **Drag & reorder batches** — HTML5 drag-and-drop on sidebar batch items; new order persisted via `save_event`
- **Per-batch path display** — shows path relative to `event.root_path`; falls back to full path if outside root; full path shown on hover tooltip; double-click opens the folder in the OS file explorer
- **Dialog defaultPath** — add-batch, frame PNG pickers, and output folder dialogs all open starting at `event.root_path`
- **Empty event flow** — `open_event` no longer auto-creates a batch; event identified by `root_path: Option<PathBuf>` field; user adds batches manually
- **Frame pre-loading** — both landscape + portrait PNGs loaded once before rayon loop in `export_batch` / `print_photos`
- **Metadata-based content hash** — `compute_content_hash` uses mtime + file size instead of full file read
- **Button rename** — "Open Folder" → "Open Event"

---

## Architecture Notes — Know Before Touching

### Event Identification
`open_event(path)` checks `root_path` on existing events first, then falls back to legacy batch `source_path`.
New events get `root_path` set to the chosen folder; **no batch is created automatically**.

---

### FS Watcher Pattern
`FsWatcher` (Rust) only emits Tauri `"folder-changed"` events — it **never touches the store directly**.
Frontend registers the listener **once** (empty deps array) and reads current state via `useRef` to avoid stale closures.
On change, frontend calls `refresh_batch` IPC which merges in Rust with full store access.

---

### Export Pipeline (Fixed)

**Current flow:**

1. `export_batch` pre-resizes both frame PNGs to `(slot_w, slot_h)` once
2. `frame_photo_for_canvas()` in `photo/batch.rs` — loads photo → crops to target ratio → resizes to slot dims → applies pre-sized frame overlay
3. `compose_one()` in `canvas/compositor.rs` — pastes slot-sized images to their grid positions (no scaling needed)

**Key files:**
- `src-tauri/src/photo/batch.rs` → `frame_photo_for_canvas()` (the main per-photo function for export)
- `src-tauri/src/commands/batch.rs` → `export_batch` / `print_photos`
- `src-tauri/src/canvas/compositor.rs` → `compose_one()`

---

## Key Files Reference

| File | Note |
|---|---|
| `src-tauri/src/canvas/compositor.rs` | Canvas grid compositor — `compose_one()` |
| `src-tauri/src/commands/batch.rs` | `export_batch` / `print_photos` — pre-resizes frames, uses `frame_photo_for_canvas` |
| `src-tauri/src/photo/batch.rs` | `frame_photo_for_canvas()` (export), `frame_photo_preloaded()` (legacy/preview) |
| `src-tauri/src/commands/project.rs` | `open_event`, `add_batch`, `delete_batch`, `delete_event`, `refresh_batch` |
| `src-tauri/src/project/model.rs` | Event / Photo / PhotoBatch data model |
| `src-tauri/src/watcher/fs_watcher.rs` | FS watcher — emits `folder-changed` Tauri events |
| `src/App.tsx` | Toolbar, sidebar (batch drag/delete/path), FS listener (`useRef` pattern) |
| `src/components/ExportDialog.tsx` | Export config + progress; uses `openPath` for result folder |
| `src/components/FramePresetDialog.tsx` | Frame preset creation; pickers default to `event.root_path` |
| `src/components/CanvasPresetForm.tsx` | Canvas preset creation; default `margin_px = 0` |
