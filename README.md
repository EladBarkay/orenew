# Orenew

**Batch photo framing for event photographers — Tauri v2 desktop app (Windows / macOS / Linux)**

> v0.1.0 — feature-complete demo build

Orenew lets photographers drag in an SD card dump, pick a decorative frame PNG per event, and export or print composite canvases (magnets, 2-up prints, etc.) in one click. Every source photo is read-only; all state lives in an internal JSON store. The heavy image work runs in Rust with SIMD resize and a bounded rayon pool.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend | Rust (stable) |
| Image processing | `image` crate — JPEG, PNG, TIFF |
| SIMD crop+resize | `fast_image_resize` |
| EXIF / XMP | `kamadak-exif` + `quick-xml` |
| Parallelism | `rayon` (CPU-bound batch), `tokio` (async IPC) |
| File watching | `notify` crate |
| Auth / entitlements | Supabase Auth (email + Google/Facebook); Rust-verified JWT (JWKS) + server-signed EdDSA device-bound entitlement token; 14-day offline grace |
| Face detection | `rustface` (SeetaFace2), embedded model — "suggest copies" |
| Updates | `tauri-plugin-updater` (signed) |

---

## Prerequisites

### All platforms
- **Rust** (stable toolchain via [rustup](https://rustup.rs)): `rustup update stable`
- **Node.js ≥ 18** + npm

### Windows
- **MSVC Build Tools** — install *Desktop development with C++* workload from the [Visual Studio installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/) or via: `winget install Microsoft.VisualStudio.2022.BuildTools`
- **WebView2** — pre-installed on Windows 10/11; otherwise download from Microsoft
- **Faster linking** (recommended): `rustup component add llvm-tools`
  - Enables `rust-lld` + `/DEBUG:FASTLINK` configured in `src-tauri/.cargo/config.toml`

### macOS
- Xcode Command Line Tools: `xcode-select --install`

### Linux
- WebKit2GTK + OpenSSL dev headers. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/#linux) for your distro.

---

## Getting Started

```bash
git clone <repo-url>
cd orenew
npm install
npm run tauri dev
```

The first build compiles ~500 Rust crates — expect **5–10 minutes**. Subsequent builds are incremental (seconds for frontend changes, 10–30 s for Rust changes).

The dev profile deliberately compiles dependencies at `opt-level 3` while your own code stays at `opt-level 1`, keeping JPEG/resize operations usable during development without sacrificing rebuild speed.

---

## Project Structure

```
orenew/
├── src/                        # React frontend
│   ├── App.tsx                 # Root component — all UI state lives here
│   ├── types.ts                # TypeScript mirrors of the Rust data model
│   ├── components/             # UI components (flat, no subfolders)
│   │   ├── Toolbar.tsx         # Slim top band: logo, event name, open/configure/delete, tier, settings
│   │   ├── BatchTabs.tsx       # Batch tab strip (drag-reorder) + view controls (grid size, sort, hide-empty)
│   │   ├── ActionBar.tsx       # Sticky bottom band: queued totals + Export; bulk controls + "Suggest copies" on selection
│   │   ├── Gallery.tsx         # react-window virtual grid of photo thumbnails (selection-aware)
│   │   ├── PhotoCard.tsx       # Thumbnail tile + qty stepper (bottom overlay; dimmed at qty 0)
│   │   ├── Lightbox.tsx        # Full-screen framed preview + nav + orientation/frame/copies/counts
│   │   ├── ExportDialog.tsx    # Print/save config: frame + canvas preset pick + manage, progress
│   │   ├── FramePresetDialog.tsx   # Create / edit frame preset
│   │   ├── CanvasPresetForm.tsx    # Create / edit canvas preset (used in ExportDialog + EventConfigDialog)
│   │   ├── EventConfigDialog.tsx   # Event-level frame + canvas preset management
│   │   ├── SettingsDialog.tsx      # Supabase sign-in (email/password + Google/Facebook), tier, devices, language
│   │   ├── DeviceManagerDialog.tsx # Device-seat picker (seat-limit interrupt + disconnect)
│   │   ├── EmptyState.tsx          # Empty gallery placeholder
│   │   ├── icons.tsx               # Inline SVG icon components
│   │   └── ui.tsx                  # Shared Modal + primitive UI components
│   ├── hooks/
│   │   ├── useThumbnail.ts         # Fetch + cache 256px thumbnail (keyed on content_hash)
│   │   ├── useFrameThumbnail.ts    # Fetch framed thumbnail (scaled preview)
│   │   ├── useFramedPreview.ts     # Fetch 1200px framed preview on demand (frame-nonce aware)
│   │   ├── useFsWatcher.ts         # Listen for `fs-changed` Tauri events
│   │   ├── useSaveProgress.ts      # Subscribe to `save-progress` Tauri events
│   │   ├── useAuthDeepLink.ts      # Handle orenew://auth-callback OAuth deep link
│   │   ├── useUpdater.ts           # Best-effort signed update check on startup
│   │   └── useAsyncForm.ts         # Form submit helper with loading/error state
│   ├── locales/                # en.ts (source of truth) + he.ts (Hebrew, RTL)
│   ├── i18n.ts                 # react-i18next setup; syncs <html lang/dir>
│   └── lib/
│       ├── paths.ts            # basename(), batchDisplayPath() helpers
│       ├── selection.ts        # rangeIds() for Shift+click selection
│       ├── reorder.ts          # reorderById() for batch tab drag
│       ├── tiers.ts            # tierLabel(), tierColor() display helpers
│       ├── supabase.ts         # supabase-js client (PKCE)
│       └── auth.ts             # establish_session + device IPC wrappers
│
├── src-tauri/
│   ├── src/
│   │   ├── main.rs             # Entry point → orenew_lib::run()
│   │   ├── lib.rs              # AppState, Tauri builder, invoke_handler, startup license load
│   │   ├── constants.rs        # Tauri event channel names (fs-changed, save-progress, face-scan-progress, …)
│   │   ├── json_store.rs       # Atomic JSON load/save (tmp-then-rename) for session/entitlement caches
│   │   ├── commands/           # Thin Tauri IPC handlers — no business logic
│   │   │   ├── project.rs      # open/create/save/delete event, batches, refresh_batch, sync_watches
│   │   │   ├── gallery.rs      # get_thumbnail, get_framed_preview, orientation overrides
│   │   │   ├── batch.rs        # save_batch, print_photos (watermark per tier)
│   │   │   ├── faces.rs        # count_faces_in_batch — rustface (SeetaFace2) face counts
│   │   │   ├── canvas_preset.rs
│   │   │   ├── frame_preset.rs
│   │   │   └── auth.rs         # establish_session, get/refresh_entitlement, list/disconnect devices, sign_out
│   │   ├── photo/              # Core image engine — zero Tauri deps, fully unit-tested
│   │   │   ├── loader.rs       # load_photo(), read_exif_orientation(), compute_content_hash()
│   │   │   ├── orientation.rs  # detect_orientation() — pixel dims + user override
│   │   │   ├── crop.rs         # compute_crop_rect() (center + rule-of-thirds), apply_crop()
│   │   │   ├── frame.rs        # apply_frame_overlay() — RGBA alpha-composite over RGB
│   │   │   ├── encode.rs       # write_print_ready() — JPEG q95 at 300 DPI
│   │   │   └── batch.rs        # frame_photo_for_canvas() — per-photo save/print path
│   │   ├── canvas/
│   │   │   └── compositor.rs   # Tile framed photos onto canvas + apply_watermark() (Free tier)
│   │   ├── project/
│   │   │   ├── model.rs        # Event, PhotoBatch, Photo, FramePreset, CanvasPreset structs
│   │   │   └── persistence.rs  # serde_json load/save with in-memory cache
│   │   ├── preview/
│   │   │   ├── thumbnail.rs    # 256px disk cache at {app_cache}/thumbs/{sha256}.jpg
│   │   │   └── framed_preview.rs  # On-demand 1200px Rust renderer
│   │   ├── auth/
│   │   │   ├── entitlement.rs       # Tier + Entitlement (grace ceiling at read time)
│   │   │   ├── entitlement_token.rs # verify server-signed EdDSA (JWS) device-bound token
│   │   │   ├── provision.rs         # mint → verify → cache entitlement token orchestration
│   │   │   ├── device.rs            # machine-uid hash + human-readable device label
│   │   │   ├── session.rs           # session.json (Supabase refresh token) load/save
│   │   │   ├── jwt.rs               # verify Supabase access token against JWKS
│   │   │   └── client.rs            # token refresh + issue/disconnect/list-devices Edge Functions
│   │   └── watcher/
│   │       └── fs_watcher.rs   # notify watcher → emits `fs-changed` Tauri event
│   ├── .cargo/config.toml      # Windows: rust-lld linker + /DEBUG:FASTLINK
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
│
├── supabase/functions/         # Edge Functions: issue-entitlement, disconnect-device
├── CLAUDE.md                   # Architecture reference for Claude Code
└── package.json
```

---

## Architecture

### Source folder is read-only

Photos are **never written or modified**. All app state is stored internally:

```
{app_data}/
  events/{event_id}/orenew.json   # event metadata, presets, print counts
  thumbs/{sha256}.jpg             # thumbnail cache
  session.json                    # Supabase session (refresh token)
  entitlement.token               # server-signed EdDSA tier token (14-day offline grace)
```

When you open a folder, the app matches it against `source_path` in existing `orenew.json` files to resume an event, or creates a new one automatically.

### Data model

```
Event
  ├── name, root_path, output_folder
  ├── frame_presets[]     ← per-event PNGs, not bundled assets
  ├── canvas_presets[]    ← "2-up 2400×1600", "4-up 3600×2400", etc.
  └── batches[]
        └── PhotoBatch
              └── photos[]
                    ├── path, width, height
                    ├── exif_orientation, orientation_override
                    ├── content_hash   ← SHA-256(photo bytes + XMP); resets print_count on change
                    ├── print_count
                    └── save_count
```

`FramePreset` stores absolute paths to two PNGs (landscape + portrait orientation variants) and the target aspect ratio. The crop is **always centered** (no rule-of-thirds option).

`CanvasPreset` stores pixel dimensions, DPI, photos-per-canvas, and grid layout (rows × columns).

### Export pipeline (per photo)

1. `load_photo()` — decode to RGB8
2. `detect_orientation()` — pixel dimensions + optional user override
3. Compute crop ratio: landscape = preset ratio, portrait = inverted ratio
4. SIMD crop + resize in one pass (`fast_image_resize`, no intermediate buffer)
5. `overlay_frame()` — alpha-composite frame PNG over photo, in-place
6. Rotate 90° if that better fills the canvas slot
7. Compositor centers the result — white letterbox padding, never stretched
8. `write_print_ready()` — JPEG q95, 300 DPI JFIF

Batch runs on a **4-thread rayon pool** (memory ceiling ~400 MB for 24 MP photos). Per-photo errors are logged and skipped; the rest of the batch continues. Progress is emitted via Tauri events.

### Preview cache

- **Thumbnails** (256 px): generated async when a batch is opened; stored on disk keyed by `content_hash`. React hook `useThumbnail` invalidates automatically when the hash changes.
- **Framed previews** (1200 px): generated on demand; stored in `AppState.preview_cache` as `HashMap<(photo_id, preset_id), Vec<u8>>`. Invalidated on orientation/crop overrides, frame preset updates/deletes, and when the frame PNG changes on disk.

### File watcher

`FsWatcher` uses the `notify` crate to watch each batch's source folder and all frame PNG paths. On change, it emits a `fs-changed` Tauri event with the file path. The frontend routes it:

- Frame PNG path → clears the Rust preview cache for that preset + bumps a nonce to force re-fetch
- Any other path → calls `refresh_batch` IPC, which recomputes `content_hash` values and resets `print_count` for changed photos

### Face detection (suggest copies)

A "Suggest copies" action in the ActionBar (visible in bulk-selection mode) seeds
per-photo export quantities from the number of faces in each photo — handy when one
magnet per guest is the norm. It runs only on click (it's heavy), with a live
progress count.

- Detector: the `rustface` crate (SeetaFace2). The frontal model
  (`src-tauri/model/seeta_fd_frontal_v1.0.bin`, ~1.2 MB) is embedded via
  `include_bytes!` — no runtime path to resolve.
- Command `count_faces_in_batch(event_id, batch_id, photo_ids?)` → `{ photoId: count }`.
  Each photo is downscaled to a 1024 px longest side before detection; the scan runs
  on the bounded rayon pool (one detector per worker) and emits `face-scan-progress`.
- The frontend (`App.tsx` `scanFaces`) merges positive counts into the export queue;
  scanned photos with 0 faces fall to qty 0 (dimmed). The suggestion is editable.

### Auth & Entitlements (Supabase)

Sign-in flow: email+password or Google/Facebook via Supabase Auth. The frontend
(`supabase-js`) only drives the interactive login, then hands the session
(`access_token` / `refresh_token` / `expires_at`) to Rust via `establish_session`.

- **Free tier**: output canvases get a procedural diagonal-stripe watermark composited at export/print time. No other limits.
- **Pro / Studio tiers**: no watermark; tier comes from a Supabase `entitlements` row.

**Rust is the source of truth for tier, and the tier is never trusted off local
disk.** It is delivered as a **server-signed, device-bound entitlement token**
(EdDSA / JWS). After sign-in the frontend hands the session to Rust via
`establish_session`; Rust verifies the access-token JWT against Supabase's public
JWKS (asymmetric keys — no secret in the binary), then calls the `issue-entitlement`
Edge Function to register this device (a `machine-uid` hash) and mint the token. The
token is verified **offline** against the `ENTITLEMENT_PUBLIC_KEY` baked in at build
time before its tier is honored — editing or copying the cache to another machine
yields Free. Caches: `session.json` (refresh token) + `entitlement.token` (signed
token). Offline use is allowed for **14 days** measured from the token's `iat` (last
successful online verification); after that the app falls back to Free.

**Device seats**: each active device occupies a seat (Pro 2, Studio 5). At the limit,
`issue-entitlement` returns `device_limit_reached` + the device list; the UI opens
`DeviceManagerDialog`, the user disconnects a device (`disconnect-device` Edge
Function), and provisioning retries.

OAuth uses PKCE and returns through the custom deep link `orenew://auth-callback`
(`tauri-plugin-deep-link`). Google/Meta only ever see Supabase's HTTPS callback,
never the custom scheme.

`auth_refresh_loop` runs at startup, online-first (retries every 60 s if offline):
refresh access token → JWKS-verify → re-mint + verify the entitlement token
(renewing the 14-day grace) → emit `tier-changed`. When offline it falls back to the
cached token; if the grace lapses it clears the caches and emits `license-expired`;
if this device lost its seat it emits `device-limit` and drops to Free.

See [`docs/supabase.md`](docs/supabase.md) for project setup and the SQL migration.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run tauri dev` | Start dev server + Rust hot-rebuild (main workflow) |
| `npm run dev` | Frontend only (Vite, no Rust) |
| `npm run build` | TypeScript type-check + production frontend bundle |
| `npm run tauri build` | Production build — creates platform installers |

**Rust tests** (run from `src-tauri/`):

```bash
cargo test                                         # unit tests: crop, model, auth (jwt/entitlement)
cargo test --release -- --ignored perf             # perf guard: asserts <100ms/photo
```

---

## Environment Variables

Backend (baked in at `cargo build` via `build.rs` — override with real env vars):

| Variable | Purpose | Default |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL. | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key (public, safe to ship). | `YOUR_SUPABASE_ANON_KEY` |

Frontend (read via `import.meta.env`, see `.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key. |

---

## Production Build

```bash
npm run tauri build
```

Installers are written to `src-tauri/target/release/bundle/`. The release profile uses `opt-level 3`, `lto = "thin"`, `codegen-units = 1`, `panic = "abort"`, and `strip = true`.

> **Release builds are guarded.** `build.rs` aborts a `release` build if
> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, or `ENTITLEMENT_PUBLIC_KEY` are still at
> their placeholder values — so an installer with dead sign-in can't ship by
> accident. Debug/dev builds stay lenient.

### Updates & signing

Orenew ships with `tauri-plugin-updater`; the app does a best-effort signed update
check on startup (`src/hooks/useUpdater.ts`). To enable it for a real release:

1. Generate a signing keypair: `npm run tauri signer generate -- -w ~/.orenew/updater.key`
2. Put the **public** key in `tauri.conf.json` → `plugins.updater.pubkey`, and set
   `plugins.updater.endpoints` to your hosted update-manifest URL.
3. At build time, provide the **private** key via the `TAURI_SIGNING_PRIVATE_KEY`
   (and password) env vars — never commit it. `bundle.createUpdaterArtifacts` is on,
   so `tauri build` emits the signed update artifacts + `latest.json` to publish.

Until a real endpoint + pubkey are configured the startup check fails silently
(no-op). Installers are currently **unsigned for code-signing purposes** — Windows
SmartScreen / macOS Gatekeeper will warn on first run until you add OS code-signing
certificates (separate from the updater key).
