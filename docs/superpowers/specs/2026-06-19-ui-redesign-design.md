# MagNet UI Redesign — Design Spec

**Date:** 2026-06-19
**Status:** Approved (design); pending implementation plan

## Context

MagNet's current UI is a dense, dark, three-pane "pro tool": a top toolbar, a
left sidebar stacking batches + frame presets + canvas presets (all drag-reorderable),
a center gallery with its own sub-toolbar, and a resizable right preview panel. It
works, but everything is visible at once and the primary loop (dump SD card → set
copies → export) competes for attention with preset management and panel chrome.

The photographer uses MagNet **live at the event**: dim room, time pressure, the same
loop repeated per SD card. The redesign keeps **all existing functionality** but
restructures the app around that loop — grid-first, fewer always-visible controls,
larger targets, keyboard-driven, faster to scan.

### Confirmed decisions
- **Full rethink** of layout *and* flow (not just a reskin).
- **Dark theme only.** No light mode, no toggle. Modernize the dark palette.
- Primary context is **live at the event** → optimize for speed + glanceability.
- Layout direction: **batch tabs + full-width grid + lightbox preview** (chosen over
  slim-rail and staged-wizard alternatives).
- Frame + canvas preset selection and management **move out of the persistent UI** and
  into the Export step.

## Goals
- Reduce on-screen chrome to three thin bands (top bar, batch tab strip, action bar);
  give the photo grid the entire remaining area.
- Cut the number of decisions on the main screen to: which batch, how many copies, export.
- Keep every current capability, just relocated.
- Refresh the dark visual language (palette, type scale, spacing, motion) to feel modern.
- Preserve i18n (en/he) and RTL throughout.

## Non-goals
- No light mode / theme toggle.
- No new image-processing, export, auth, or watcher behavior — this is a UI/UX
  restructure over the existing Rust backend and IPC commands.
- No change to the data model (`Event`, `PhotoBatch`, `Photo`, `FramePreset`,
  `CanvasPreset`) or persisted state.
- RAW support, printer-dialog wiring, and other backlog items remain out of scope.

## Layout

```
+-----------------------------------------------------------+
| (◉) MagNet   ·   Event Name        [Open Event]   (⚙ Pro) |   top bar
+-----------------------------------------------------------+
| ⬚ Batch1 *   ⬚ Batch2   ⬚ Batch3   +      [hide empty] [◧] |   batch tab strip + view controls
+-----------------------------------------------------------+
|   ▢    ▢    ▢    ▢    ▢    ▢                               |
|   ▢    ▢    ▢    ▢    ▢    ▢          full-bleed grid       |
|   ▢    ▢    ▢    ▢    ▢    ▢                               |
+-----------------------------------------------------------+
| 24 copies · 9 photos                   [   Export 24  ▶ ] |   sticky action bar
+-----------------------------------------------------------+
```

Three chrome bands; everything else is photos.

- **Top bar** (slim): logo + wordmark, event name, `Open Event`, settings/tier chip,
  delete-event. Mirrors today's `Toolbar` minus the inline Export button (moves to the
  action bar) and slimmer.
- **Batch tab strip**: each batch is a horizontal tab (thumbnail/initial + name + photo
  count); active tab highlighted in indigo. `+` adds a batch. Tabs are drag-reorderable
  (reuse `reorderById` + `save_event`, same as today's sidebar). Right side of the strip
  holds the two view controls: **hide-empty** toggle and **grid-size** control. Grid
  size is adjustable three ways: visible **− / +** buttons, **Ctrl + wheel**, and
  **Ctrl + − / +** keyboard (the existing wheel + keyboard handlers are kept; the
  buttons are new and call the same clamp/step logic).
- **Grid**: full-width `react-window` virtual grid of `PhotoCard`s. Each card keeps an
  always-visible qty stepper (large targets) at the bottom. Selection visuals (ring) use
  the indigo accent.
- **Action bar** (sticky bottom): default state shows `{queuedTotal} copies · {n} photos`
  and a single primary `Export {queuedTotal} ▶` button (disabled at 0). This replaces
  the toolbar Export button.

The left `Sidebar` and the docked right `PreviewPanel` are removed from the shell.

## Flow

Per SD-card loop:
1. `Open Event` (or auto-resumed) → first batch tab selected, grid fills.
2. Optionally switch batch tabs; optionally `+` to add a batch (SD dump).
3. Set copies: per-card stepper, or select photos and use the contextual bar, or
   `Suggest copies` (face scan).
4. `Export` → dialog picks frame + canvas (sticky defaults pre-filled) and destination
   (Print / Save), runs, bumps counts, clears queue.

Frame/canvas choices live in step 4 only. With sticky defaults remembered per event,
the common case is: set copies → Export → confirm.

## Preview — lightbox

Clicking a photo (or pressing Enter on the focused card) opens a **full-screen modal
overlay**, replacing today's docked `PreviewPanel`:
- Large framed preview (same on-demand Rust framed-preview pipeline, keyed by
  `(photo_id, preset_id)`; honors `frameNonce`).
- `←` / `→` move to previous/next visible photo; `Esc` closes; arrows already wired in
  `App` get repurposed to drive the lightbox.
- Controls: orientation override + clear, rotate, and the photo's save/print counts —
  the exact controls in today's `PreviewPanel`, re-housed.
- The qty stepper is also available here so copies can be set while reviewing.

Rationale: frees the full width for the grid (the main live-use surface) and makes
review an intentional, focused mode rather than a permanent panel.

## Selection & bulk actions

- Default: action bar shows totals + Export (above).
- With a selection (click / shift-range / ctrl-toggle / ⌘A — all existing handlers),
  the action bar **swaps to a contextual bar**:
  `{n} selected · copies [– {qty} +] · Suggest copies (faces) · Clear`.
  - `copies` stepper drives `handleSetAllQty` over the selection.
  - `Suggest copies` runs `scanFaces` (existing `count_faces_in_batch` IPC) scoped to
    the selection, with the live progress count shown inline.
  - `Clear` deselects.
- This absorbs today's `GalleryToolbar` (set-all qty, suggest-copies, hide-empty). The
  hide-empty + grid-size controls relocate to the tab strip so they're always reachable;
  set-all + suggest become selection-contextual.

## Preset management

Both frame and canvas presets are selected and managed **inside the Export dialog**:
- A row of visual **preset chips** for frames and for canvases; the active one is
  highlighted. Selection persists as the event's sticky default. Frames already use
  `active_frame_preset_id`; add a parallel persisted `active_canvas_preset_id` on
  `Event` so the **last-used canvas is remembered across app reloads** (written to
  `magnet.json` via `save_event`, same path as the frame default).
- A small **Manage** control opens add/edit/delete/reorder, reusing the existing
  `FramePresetDialog` and `CanvasPresetForm` components and the existing
  create/update/delete/reorder IPC commands. Reorder reuses `reorderById` + `save_event`.

No preset UI appears anywhere else; it is only surfaced at export time, when it matters.

## Visual language

Dark, modern, calm. Tailwind 4 (no config file today — introduce a small set of CSS
custom-property tokens in `index.css` for the new palette so surfaces stay consistent).

- **Palette**: deep neutral base (`neutral-950`/`neutral-900` surfaces, `neutral-800`
  raised). Single **indigo accent `#5B5BD6`** (logo color) for primary buttons,
  selection rings, active tab. Retire `blue-600`. Semantic red kept for destructive.
- **Elevation**: surface-step + hairline borders (`border-neutral-800`) over heavy
  shadows. `rounded-lg` cards, `rounded-2xl` dialogs/lightbox.
- **Type**: one bold display (event name), uppercase tracked micro-labels for section
  headers, consistent `text-sm` body. Tighten the scale; more whitespace.
- **Targets**: larger hit areas on steppers, tabs, and primary actions for live use.
- **Motion**: fast and cheap (~150ms) — tab switch, lightbox enter/exit, action-bar ↔
  contextual-bar swap. No heavy animation.
- **i18n/RTL**: all strings via i18next (en/he); continue using Tailwind logical
  utilities (`ms/me`, `ps/pe`, `start/end`) so RTL flips for free.

## Component map (impact)

| Existing | Change |
|---|---|
| `App.tsx` | Reworked shell: tab strip + grid + action/contextual bar + lightbox state. State (`photoQueue`, selection, `frameNonce`, etc.) and IPC calls preserved. |
| `Toolbar.tsx` | Slimmed; Export button removed (→ action bar). |
| `Sidebar.tsx` | **Removed.** Batches → tab strip (new `BatchTabs`); presets → Export dialog. |
| `GalleryToolbar.tsx` | **Removed.** Controls split: hide-empty + size → tab strip; set-all + suggest → contextual selection bar. |
| `PreviewPanel.tsx` | Re-housed into a new full-screen `Lightbox` (same controls/data). |
| `Gallery.tsx` / `PhotoCard.tsx` | Kept (virtual grid, stepper). Restyled to new tokens; grid goes full-width. |
| `ExportDialog.tsx` | Gains frame + canvas preset chips + inline **Manage**; sticky defaults. |
| `FramePresetDialog.tsx`, `CanvasPresetForm.tsx`, `CanvasPresetManager.tsx` | Reused inside Export's Manage flow. |
| New | `BatchTabs`, `ActionBar` (+ contextual variant), `Lightbox`. |
| Backend (Rust), IPC commands, types, hooks, watcher, i18n keys | **Unchanged** in behavior; new/renamed i18n strings added for relocated controls. |

## Success criteria
- Main screen shows only three chrome bands; the grid occupies the rest.
- A photographer can complete the loop (open → set copies → export) without opening a
  side panel and with frame/canvas defaults pre-filled.
- Every capability from the current UI is reachable: batches (add/switch/reorder/delete),
  per-photo + bulk copies, suggest-copies (face scan), hide-empty, grid sizing,
  orientation override, save/print counts, frame/canvas preset CRUD, settings/tier,
  watcher-driven refresh, watermark-by-tier.
- Dark-only, indigo-accented, consistent tokens; en/he + RTL intact.
- No regression in the Rust pipeline or IPC contracts.

## Resolved decisions
- **Sticky canvas default:** persist `active_canvas_preset_id` on `Event` (in
  `magnet.json`); the last-used canvas is restored on app reload.
- **Grid-size control:** support all three — visible − / + buttons, Ctrl + wheel, and
  Ctrl + − / + keyboard.
