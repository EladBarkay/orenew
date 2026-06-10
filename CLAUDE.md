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

```
magnet/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/          # Thin Tauri IPC handlers (batch, preview, project, license)
│   │   ├── photo/             # Core image processing — no Tauri deps, fully testable
│   │   │   ├── loader.rs      # load_photo(), read_exif(), read_xmp()
│   │   │   ├── orientation.rs # detect_orientation()
│   │   │   ├── crop.rs        # crop_image(), CropRect
│   │   │   ├── frame.rs       # apply_frame_overlay(), FramePreset
│   │   │   ├── export.rs      # export_print_ready()
│   │   │   └── batch.rs       # BatchProcessor, process_batch()
│   │   ├── canvas/            # Canvas compositor (tile photos onto CanvasPreset)
│   │   ├── project/           # Event persistence: model.rs + persistence.rs (serde_json)
│   │   ├── preview/           # thumbnail.rs + framed_preview.rs
│   │   ├── license/           # validator.rs
│   │   └── watcher/           # fs_watcher.rs — notify + print_count reset logic
│   └── Cargo.toml
├── src/
│   ├── components/
│   │   ├── Gallery/           # Virtual photo grid with print count badges
│   │   ├── FramePicker/       # Per-event frame PNG selector
│   │   ├── Preview/           # Single photo framed preview
│   │   ├── BatchProgress/     # Export/print progress overlay
│   │   └── Settings/          # License key entry, output folder config
│   ├── store/                 # Jotai atoms (eventAtom, batchAtom, licenseAtom)
│   └── hooks/                 # useBatch.ts, usePreview.ts
└── package.json
```

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
