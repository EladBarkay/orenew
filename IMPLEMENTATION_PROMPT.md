You are a senior backend engineer building the photo frame application. You're starting with the core batch processing engine — the pipeline that loads a folder of photos, applies frame + cropping logic, and outputs print-ready files.

## Context
The app needs:
- Load photos from a directory (JPG, PNG, RAW with XMP sidecar, TIFF)
- Auto-detect frame (landscape/portrait) based on photo orientation and user presets
- Apply cropping to match frame ratio
- Render output with frame overlay
- Batch process 100+ photos efficiently without blocking the UI

You have a working architecture decision from the planning phase. This task focuses on: **the batch processing engine module** that handles photo → cropped frame → export.

## Detailed Requirements

1. **Input**: A folder path + user-selected frame preset
   - Frame preset: name, width/height ratio, how to crop (center, rule-of-thirds, smart), landscape/portrait rules
   - User can override orientation per photo if auto-detect fails

2. **Processing Pipeline**
   - Read photo + XMP sidecar (if present)
   - Detect orientation (EXIF data, user override, AI heuristic if desired)
   - Select frame (landscape vs portrait based on orientation + preset rules)
   - Apply cropping to target ratio (center crop, smart crop, or user-defined)
   - Composite frame overlay onto cropped image
   - Generate output (in-memory, don't block UI)

3. **Output**
   - Each result: cropped image + frame, ready for printing
   - Format: RGB JPEG for print (300 DPI metadata if possible)
   - Progress callback (for UI progress bar: X/Y processed, current file)

4. **Performance**
   - Load and process 100 photos in <10 seconds (parallel where possible)
   - Memory efficient (don't load all images at once)
   - Non-blocking (must emit progress events so UI can update)

5. **Error Handling**
   - Missing or invalid frame → graceful fallback or skip
   - Corrupted photo → log and skip, continue
   - XMP parse error → ignore sidecar, use EXIF only
   - Output disk full → clear error to caller

---

## Deliverables

Provide a **working implementation** of the batch processing module. Output:

1. **Module structure** (pseudocode or actual code)
   - `PhotoBatch` struct/class (holds the job state)
   - `FramePreset` struct (frame metadata)
   - `process_batch(folder_path, preset) -> Iterator<Result<ProcessedPhoto>>`

2. **Core functions**
   - `load_photo(path) -> Photo` (read image + EXIF/XMP)
   - `detect_orientation(photo) -> Orientation` (auto or override)
   - `select_frame(orientation, preset) -> Frame`
   - `crop_image(photo, frame, crop_method) -> CroppedImage`
   - `apply_frame_overlay(cropped, frame) -> FramedImage`
   - `export_print_ready(framed, output_path) -> Result`

3. **Async/concurrency strategy**
   - How to parallelize without blocking the caller
   - Progress callback interface

4. **Test cases** (3-5 key scenarios)
   - Landscape photo + portrait preset
   - Missing XMP sidecar
   - Batch with mixed orientations
   - Progress callback fires correctly

5. **Example usage** (pseudocode showing the interface)

---

## Constraints
- **Language**: [Specify: Rust, Python, Java, Kotlin] — match your architecture decision
- **Libraries**: Use only stable, actively-maintained image libraries (e.g., `image-rs` for Rust, `Pillow` for Python, `ImageIO` for Java)
- Only implement the batch engine core. Do not implement UI, printing, file dialogs, or subscription logic — those are separate modules.
- Make the code testable and modular — frame detection and cropping must be independently testable.
- Error handling: return `Result` types, not exceptions.

---

## Output Format
Use clean, readable code. Include:
- Type signatures / class definitions (so the caller knows the interface)
- Implementation for 2-3 core functions (full, not stubs)
- Progress callback interface (show how the caller wires it to the UI)
- 1-2 test cases with assertions

No scaffolding, no boilerplate — show the essential logic and the interface. Someone should be able to integrate this into the UI layer without rewriting it.

Done when: A developer can take this code, wire up a folder picker and UI progress bar, and have a working batch processor.
