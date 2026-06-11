# Bug Fix Implementation Plan

## BUG FIX A.1: Export Count Tracking Per Photo

**Current State:**
- Print quantities are tracked in `App.tsx` as `printQueue: Record<string, number>` (session-only state)
- On successful print, `print_count` is incremented per photo
- This is separate from persistent `Photo.print_count` in the model

**Desired State:**
- Add `export_count: u32` field to `Photo` model (persistent, like `print_count`)
- Add `exportQueue: Record<string, number>` in `App.tsx` (session-only, like `printQueue`)
- User can set export quantities per photo in gallery cards
- ExportDialog respects export quantities (expands photos by quantity)
- On successful export, `export_count` is incremented per photo

**Changes Required:**

### Rust Backend (src-tauri)
1. **`src-tauri/src/project/model.rs`**
   - Add `pub export_count: u32` to `Photo` struct
   - Initialize to `0` in `scan_photo()`

2. **`src-tauri/src/commands/batch.rs`**
   - Modify `export_batch` to accept `export_quantities: Map<PhotoId, u32>` parameter
   - Expand photos by export quantities in the pipeline (like print does)
   - Increment `export_count` on successful export per photo

### Frontend (src/)
1. **`src/App.tsx`**
   - Add `exportQueue: Record<string, number>` state
   - Add `setExportQueue()` function
   - Pass both to `<Gallery>` and `<ExportDialog>`

2. **`src/components/Gallery.tsx` / `PhotoCard.tsx`**
   - Add export quantity badge/stepper (next to print quantity)
   - Sync with `exportQueue` state
   - Visual indicator distinguishing export from print

3. **`src/components/ExportDialog.tsx`**
   - Before calling `export_batch`, pass `exportQueue` as parameter
   - Update export summary to show "Will export X photos (with quantities)"

**Files Modified:**
- `src-tauri/src/project/model.rs` (add field)
- `src-tauri/src/commands/batch.rs` (accept & use quantities)
- `src/App.tsx` (add state)
- `src/components/Gallery.tsx` or `PhotoCard.tsx` (add UI)
- `src/components/ExportDialog.tsx` (pass quantities)

**Testing:**
- Set export quantities on 3 photos (e.g., 2, 1, 3)
- Export batch
- Verify exported folder has 6 files (2+1+3)
- Close and reopen app, verify `export_count` persisted

---

## BUG FIX A.2: Double-Click Batch to Open Folder

**Current State:**
- The session log says "double-click opens the folder in the OS file explorer" is implemented
- But you report it doesn't work

**Possible Issue:**
- Feature only works on certain areas (not the batch name)
- Or event listener not properly attached

**Desired State:**
- Double-click on batch row/name in left sidebar → opens batch folder in OS explorer

**Changes Required:**

### Frontend (src/)
1. **`src/App.tsx`** (Sidebar batch item)
   - Add `onDoubleClick` handler to batch item
   - Extract batch `source_path`
   - Call `openPath(source_path)` from `@tauri-apps/plugin-opener`

**Files Modified:**
- `src/App.tsx` (add double-click handler to batch item)

**Testing:**
- Double-click a batch in left sidebar
- Verify OS file explorer opens with the batch folder

---

## BUG FIX A.3: Batch Path Display with Event Root Prefix

**Current State:**
- Batch path shows relative to event root but doesn't show the context
- Hard to understand if path is deeply nested or not

Example:
```
Batch: "SD_Card_1"
"photos"  ← unclear if this is /event/photos or /event/wedding/photos
```

**Desired State:**
- Show full path context
- Include event root as prefix
- If path is outside event root, show absolute path

Example (path is relative to event root):
```
Batch: "SD_Card_1"
path: /home/elad/events/wedding/photos
Hover: /home/elad/events/wedding/photos
```

Example (path is outside event root):
```
Batch: "External_Card"
path: /mnt/usb/photos
Hover: /mnt/usb/photos
```

**Changes Required:**

### Frontend (src/)
1. **`src/App.tsx`** (Batch item display)
   - Get `event.root_path` and `batch.source_path`
   - Compute display path:
     - If batch path starts with event root: show `eventRoot/relativePath`
     - Else: show full absolute path
   - Show on both: inline text AND tooltip on hover
   - Add "path: " prefix label

**Helper Function:**
```typescript
function getBatchDisplayPath(eventRoot: string | undefined, batchPath: string): string {
  if (!eventRoot) return batchPath;
  if (batchPath.startsWith(eventRoot)) {
    const rel = batchPath.slice(eventRoot.length).replace(/^\//, '');
    return `${eventRoot}/${rel}`;
  }
  return batchPath;
}
```

**Files Modified:**
- `src/App.tsx` (update batch path display logic)

**Testing:**
- Event root: `/home/elad/events/wedding`
- Batch 1 path: `/home/elad/events/wedding/sd_card_1` → shows `path: /home/elad/events/wedding/sd_card_1`
- Batch 2 path: `/mnt/usb/photos` → shows `path: /mnt/usb/photos`
- Hover shows full path in tooltip

---

## Implementation Order
1. **A.2 (Double-Click)** — Simplest, 15 mins
2. **A.3 (Path Display)** — Simple frontend, 20 mins
3. **A.1 (Export Count)** — Most complex, 2 hours (Rust + React)

---

## Git Strategy
- A.2 + A.3: One commit `fix: improve batch display and double-click folder open`
- A.1: Separate commit `feat: add export count tracking per photo`
