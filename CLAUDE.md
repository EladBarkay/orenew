# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MagNet** is a cross-platform desktop application for event photographers to batch-apply custom decorative frames to photos for printing and magnet production. The photographer works one event at a time; each event has multiple photo batches (one per SD card dump), per-event frame PNGs, canvas presets for print/export, and a fixed output folder.

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| State | Jotai (atomic) |
| Backend | Rust (stable) |
| Image processing | `image` crate (image-rs) — JPG, PNG, TIFF (RAW deferred to v2) |
| EXIF/XMP | `kamadak-exif` + `quick-xml` |
| Parallelism | `rayon` (CPU-bound batch), Tokio (async/IPC) |
| File watching | `notify` crate |
| Licensing crypto | `hmac` + `sha2` + `base32` |

## Architecture

### Source Folder Is Read-Only

The photographer's source folder is **never modified**. All app state lives in internal storage:

```
{app_data}/
  events/{event_id}/magnet.json   # all event state
  thumbs/                          # thumbnail cache (SHA-256 keyed)
  license.json
```

When opening a folder, the app matches it against `source_path` in existing `magnet.json` files to resume, or creates a new event.

### Core Data Model

- **Event** — top-level: name, list of `PhotoBatch`es, active `FramePreset`, `CanvasPreset`s, output folder path
- **PhotoBatch** — absolute `source_path` to photographer's folder, list of `Photo`s
- **Photo** — path, EXIF orientation, user overrides (orientation, crop), `print_count`, `content_hash` (SHA-256 of photo + XMP bytes — resets `print_count` when it changes)
- **FramePreset** — absolute paths to landscape + portrait PNG (alpha), target ratio, crop method (center or rule-of-thirds)
- **CanvasPreset** — pixel dimensions, photos-per-canvas, DPI, grid layout (e.g. 2400×1600, 2-up)

Frames are per-event PNGs provided by the photographer (no bundled frames). Paths stored as absolute paths.

### Batch Processing Pipeline

`process_batch(batch, preset, tx)` via `rayon::par_iter` (max 4 concurrent):

1. `load_photo(path)` → reads image + EXIF + XMP sidecar
2. `detect_orientation(photo)` → EXIF tag → fall back to pixel dimensions → apply user override
3. `select_frame(orientation, preset)` → picks landscape or portrait PNG
4. `crop_image(photo, frame, method)` → computes `CropRect`, applies crop
5. `apply_frame_overlay(cropped, frame)` → alpha composite
6. `export_print_ready(framed, out_path)` → RGB JPEG at 300 DPI

Errors per photo: log and skip; batch continues. Progress emitted via Tauri events.

### Preview Pipeline

- Thumbnails (256px) generated async at batch open, cached to `{app_cache}/thumbs/{sha256}.jpg`
- Virtual list (react-window) in gallery; only visible thumbnails rendered
- Full framed preview: on-demand Rust, cached per `(photo_id, preset_id)`, returned as bytes

### Print / Export

- **Export**: canvases written to `{output_folder}/{YYYY-MM-DD_HH-MM-SS}/` — no prompt, uses event's fixed output folder
- **Print**: user sets per-photo print quantity → compositor tiles framed photos onto canvas → OS print dialog → `print_count` incremented
- **Canvas presets**: user-defined per event (e.g. "2-up 2400×1600", "4-up 3600×2400")

### File System Watcher

`notify` watches each batch's source folder + all frame PNG paths:
- New photo → auto-add, generate thumbnail
- Photo/XMP change → recompute `content_hash`; if changed: reset `print_count`, invalidate thumbnail
- Frame PNG change → invalidate framed previews using that frame, UI refreshes immediately

### Licensing (v1 — Offline)

Key format: `MAGNET-{BASE32(HMAC-SHA256(email|expiry|tier, SECRET))}`

- **Free tier**: output watermarked (composited on export/print canvas). No other limits.
- **Pro tier**: no watermark.
- Secret baked into binary at compile time via `MAGNET_LICENSE_SECRET` env var.

## Folder Structure

> Reflects the actual codebase (kept in sync — do not revert to the original plan).

```
magnet/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs            # thin entry → magnet_lib::run()
│   │   ├── lib.rs             # AppState, Tauri builder, invoke_handler, license load
│   │   ├── commands/          # Thin Tauri IPC handlers
│   │   │   ├── project.rs     # open/create/save/delete event, batches, refresh_batch, sync_watches
│   │   │   ├── gallery.rs     # list_photos, get_thumbnail, get_framed_preview, overrides (preview IPC lives here)
│   │   │   ├── batch.rs       # export_batch, print_photos (watermark per tier)
│   │   │   ├── canvas_preset.rs  # list/create/update/delete_canvas_preset
│   │   │   ├── frame_preset.rs   # list/create/update/delete_frame_preset
│   │   │   └── license.rs     # validate_license, get_license_info, clear_license
│   │   ├── photo/             # Core image processing — no Tauri deps, unit-tested
│   │   │   ├── loader.rs      # load_photo(), read_exif_orientation(), compute_content_hash() (content-based)
│   │   │   ├── orientation.rs # detect_orientation() → Photo::effective_orientation()
│   │   │   ├── crop.rs        # compute_crop_rect() (center + rule-of-thirds), apply_crop() [tests]
│   │   │   ├── frame.rs       # apply_frame_overlay(), apply_frame_overlay_image() [tests]
│   │   │   ├── export.rs      # export_print_ready() — RGB JPEG q95, 300 DPI JFIF
│   │   │   └── batch.rs       # frame_photo_for_canvas() (export/print per-photo path)
│   │   ├── canvas/            # compositor.rs — tile + apply_watermark() (procedural, free tier)
│   │   ├── project/           # model.rs + persistence.rs (serde_json, in-memory cache) [tests]
│   │   ├── preview/           # thumbnail.rs (256px disk cache) + framed_preview.rs (1200px)
│   │   ├── license/           # validator.rs — HMAC-SHA256 key validation [tests]
│   │   └── watcher/           # fs_watcher.rs — notify, emits `fs-changed` with changed path
│   └── Cargo.toml
├── src/
│   ├── components/            # flat (no nested folders)
│   │   ├── Gallery.tsx        # react-window FixedSizeGrid virtual grid
│   │   ├── PhotoCard.tsx      # thumbnail tile + print-count badge + print-qty stepper
│   │   ├── PreviewPanel.tsx   # framed preview + metadata
│   │   ├── ExportDialog.tsx   # export config + progress
│   │   ├── PrintConfirmDialog.tsx  # frame+canvas preset pickers → print; "Sent X files"
│   │   ├── FramePresetDialog.tsx   # create/edit frame preset
│   │   ├── CanvasPresetForm.tsx    # create/edit canvas preset (used by manager)
│   │   ├── CanvasPresetManager.tsx # list/edit/delete canvas presets
│   │   └── SettingsDialog.tsx      # license key entry, tier/expiry
│   └── hooks/                 # useThumbnail.ts, useFramedPreview.ts, useExportProgress.ts
└── package.json              # state via React useState/useRef in App.tsx (no jotai, no src/store/)
```

### Print flow (current)

Per-photo print quantities are set on gallery cards (App `printQueue` state, separate from
historical `print_count`). The toolbar **Print** button opens `PrintConfirmDialog` to pick a
frame preset + canvas preset, then calls `print_photos`, which composes watermarked-if-Free
canvases to a temp dir and returns the file count ("Sent X files for printing"). Actual printer
submission is deferred — no files are sent to the OS printer yet.

### Licensing (current)

`license.json` is loaded into `AppState.license` at startup; `AppState::tier()` gates
watermarking in `export_batch`/`print_photos`. Free tier composites a procedural diagonal-stripe
watermark (no bundled asset/font). Settings UI activates/clears licenses.

### File watcher (current)

`FsWatcher` emits a Tauri `fs-changed` event with the changed file path. The frontend decides:
a frame-PNG path → bump a preview nonce to refetch framed previews; otherwise refresh the owning
batch via `refresh_batch` (which recomputes content hashes and resets `print_count` for changed
photos in `merge_photos`). Thumbnails bust automatically because `useThumbnail` keys on
`content_hash`. `sync_watches` re-establishes watches (batch folders + frame dirs) on event open.

## Performance Targets

| Target | Strategy |
|---|---|
| Gallery scroll <16ms | react-window virtual list; pre-cached thumbnails |
| Thumbnail <200ms | Disk-cached at batch open |
| Framed preview <500ms | On-demand Rust, cached per (photo, preset) |
| 100 photos <10s | rayon, max 4 in-flight (~70MB each decoded) |
| Memory ceiling ~500MB | Bounded concurrency in rayon pool |

## Implementation Order

1. `photo/` — batch engine (loader, orientation, crop, frame, export)
2. `project/` — event persistence
3. `preview/` — thumbnail cache + framed preview
4. `canvas/` — canvas compositor
5. `watcher/` — FS watcher + print_count reset
6. Tauri commands + React gallery skeleton
7. Frame setup UI + mid-event swap
8. Canvas preset manager + export/print UI with quantity selector
9. License validation + watermark compositing
