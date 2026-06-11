# MagNet Performance Targets (v1.0 Verification)

## Definition of Done (Performance)

MagNet v1.0 is production-ready when:
- **Export speed**: 0.1 seconds per photo (0.2s max for 2-photo canvas)
- **Preview generation**: < 500ms (framed preview on-demand)
- **Gallery scroll**: smooth, consistent 60 FPS (< 16ms per frame)
- **Thumbnail load**: < 200ms (from disk cache)
- **Memory peak**: < 500MB during 100-photo batch export
- **No lag**: UI remains responsive during processing

---

## Export Speed Target (Critical)

### Requirement
- **0.1 seconds per photo** (100 photos = ~10 seconds total)
- **0.2 seconds max for 2-photo canvas** (e.g., 2-up preset with 2 framed photos)

### Breakdown

Typical export workflow for one photo:
1. Load photo (JPEG/RAW): 10-20ms
2. Read EXIF/XMP: 2-5ms
3. Detect orientation: 1-2ms
4. Select frame (landscape/portrait): <1ms
5. Crop image to target ratio: 5-10ms
6. Apply XMP adjustments (if any): 10-15ms
7. Composite frame overlay: 10-15ms
8. Export to JPEG (q95, 300 DPI): 10-20ms
9. Write to disk: 5-10ms

**Total per photo**: 54-108ms → target 100ms ceiling

### Benchmark Methodology

#### Test Setup
1. Create 100 test JPEGs:
   - Dimensions: 3000×2000px (typical DSLR)
   - File size: ~2.5MB each
   - Total: 250MB batch
2. Create frame preset:
   - Landscape PNG: 3000×2400px with alpha
   - Portrait PNG: 2000×3000px with alpha
3. Create canvas preset:
   - Layout: 2-up (2 photos horizontal)
   - Canvas size: 2400×1600px
   - Margins: 0px
   - DPI: 300

#### Execution
```bash
# Pseudocode for benchmark
START = clock()
export_batch(batch_of_100_photos, canvas_preset)
END = clock()

TOTAL_TIME = END - START
TIME_PER_PHOTO = TOTAL_TIME / 100

PRINT "Total: $TOTAL_TIME seconds"
PRINT "Per photo: $TIME_PER_PHOTO seconds"
PRINT "Status: $(TIME_PER_PHOTO < 0.1 ? "PASS" : "FAIL")"
```

#### Success Criteria
```
✅ PASS: 100 photos in ≤ 10 seconds (≤ 0.1s per photo)
⚠️  WARN: 100 photos in 10-12 seconds (0.1-0.12s per photo) → optimize
❌ FAIL: 100 photos in > 12 seconds (> 0.12s per photo) → refactor required
```

---

## Preview Speed Target

### Framed Preview (On-Demand)
- **Target**: < 500ms from click to rendered image
- **Cached**: Per (photo_id, preset_id), reused within session
- **Invalidation**: On frame/canvas preset change, photo override change, XMP sidecar change

### Workflow
```
User clicks photo → Rust loads + crops + applies XMP + composites frame → 
Returns image bytes → React renders preview in modal
Duration: < 500ms
```

### Benchmark
1. Select random photo from 100-photo batch
2. Click to open preview
3. Measure time from click to image visible
4. Repeat 10 times, average
5. **Pass if**: average < 500ms, no outliers > 1s

---

## Gallery Scroll Speed Target

### Requirement
- **60 FPS**; equivalent to < 16ms per frame
- **Virtual list** (react-window) renders only visible tiles
- **Smooth**: No jank, stutter, or frame drops when scrolling

### Benchmark
1. Load batch with 100 photos (gallery grid visible)
2. Use DevTools performance profiler
3. Scroll continuously for 5 seconds
4. Measure frame time and FPS
5. **Pass if**: FPS ≥ 58, frame time ≤ 17ms

### Optimization Targets (if needed)
- Thumbnail caching (current: cached at batch load)
- Virtual list row/column size tuning (current: 256px tiles)
- CSS selector optimization in PhotoCard component
- Image decoding on main thread vs worker thread (defer to v1.1 if needed)

---

## Thumbnail Load Speed

### Requirement
- **< 200ms** per thumbnail (from disk cache)
- **Cached at batch load**: thumbnails generated once, reused
- **Invalidation**: On photo content change (content_hash updates)

### Current Implementation
- Thumbnails generated on batch open: `generate_thumbnails()`
- Stored at: `{app_cache}/thumbs/{content_hash}.jpg`
- Size: 256px (small enough to load fast)

### Benchmark
1. Open batch with 100 photos (cold cache)
2. Measure time from batch open to all thumbnails visible
3. Measure individual thumbnail load time (sample 10 random)
4. **Pass if**: All visible in < 2 seconds, individual < 200ms

---

## Memory Peak Target

### Requirement
- **< 500MB** during full 100-photo batch export
- **Streaming**: Process photos sequentially or with bounded concurrency
- **Cleanup**: Free decoded images immediately after processing

### Current Implementation
- Rayon concurrency: max 4 photos in-flight
- Per photo memory: ~70MB (decoded image + frame + canvas)
- Peak estimate: 4 × 70MB = 280MB + overhead ≈ 350-400MB

### Benchmark Procedure

#### Setup
1. Create 100 test JPEGs (3000×2000px, 2.5MB each)
2. Create canvas preset: 2-up, high resolution output
3. System with 8GB+ RAM (typical development machine)

#### Execution
```bash
# On Linux / macOS
export_batch(&batch)  # Monitor with: top, htop, or Activity Monitor

# Record:
- Peak memory usage (RSS)
- Average memory during processing
- Memory cleanup after export completes
```

#### Success Criteria
```
✅ PASS: Peak ≤ 500MB
⚠️  WARN: Peak 500-600MB → monitor, may vary by OS/system
❌ FAIL: Peak > 600MB → reduce concurrency or refactor
```

### Memory Reduction Strategies (if peak exceeded)
1. Reduce rayon concurrency: 4 → 3 or 2 (slower but lower memory)
2. Use streaming decompression (decode JPEG, process, discard immediately)
3. Pre-allocate buffer pools (reuse memory across photos)
4. Reduce thumbnail batch generation (generate on-demand instead of all at once)

---

## UI Responsiveness Target

### Requirement
- **Main thread not blocked** during export
- **UI updates** (progress bar, status text) flow smoothly
- **No freezing** when canceling export or switching views

### Implementation
- All CPU-bound work (photo processing) runs on Tauri background threads
- IPC events emit progress updates (non-blocking)
- React state updates trigger re-renders without lag
- Cancellation propagates immediately via atomic flag

### Benchmark
1. Start export of 50+ photos
2. While exporting:
   - Click UI buttons (cancel, switch preset, etc.) → should respond instantly
   - Observe progress bar → should update every ~1 second smoothly
   - No modal freezes or delays
3. **Pass if**: All interactions responsive, no perception of lag

---

## Combined Benchmark Script

### Full e2e Performance Test (recommended)

```bash
#!/bin/bash
# MagNet v1.0 Performance Benchmark

set -e

echo "=== MagNet v1.0 Performance Benchmark ==="
echo ""

# Prerequisites
echo "1. Creating test batch (100 JPEGs, 3000×2000px)..."
# [Create test files or use existing batch]

echo "2. Launching app..."
# [Start MagNet]

echo "3. Export benchmark (100 photos)..."
START=$(date +%s%N)
# [Trigger export via UI]
# [Wait for completion]
END=$(date +%s%N)

ELAPSED=$((($END - $START) / 1000000))  # Convert ns to ms
ELAPSED_SEC=$(echo "scale=2; $ELAPSED / 1000" | bc)
TIME_PER_PHOTO=$(echo "scale=3; $ELAPSED_SEC / 100" | bc)

echo "   Total time: ${ELAPSED_SEC}s"
echo "   Per photo: ${TIME_PER_PHOTO}s"

if (( $(echo "$TIME_PER_PHOTO <= 0.1" | bc -l) )); then
  echo "   Status: ✅ PASS"
else
  echo "   Status: ❌ FAIL"
fi

echo ""
echo "4. Memory benchmark..."
# [Monitor peak memory during export]
# [Record and report]

echo ""
echo "5. Preview speed (10 samples)..."
# [Click on 10 random photos, measure preview load time]
# [Record average]

echo ""
echo "6. Gallery scroll test..."
# [Scroll continuously, measure FPS with DevTools]
# [Record average]

echo ""
echo "=== Benchmark Complete ==="
```

---

## Performance Regression Testing

### Continuous Monitoring
To prevent performance regressions in future releases:

1. **Unit test performance assertions**:
   ```rust
   #[test]
   fn bench_crop_performance() {
     let start = Instant::now();
     for _ in 0..1000 {
       compute_crop_rect(3000, 2000, (2.0, 3.0), CropMethod::Center);
     }
     let elapsed = start.elapsed();
     assert!(elapsed < Duration::from_millis(100), "crop too slow");
   }
   ```

2. **Benchmark suite**:
   - Create `benches/photo_processing.rs` with Criterion.rs
   - Run before each release
   - Compare against baseline (this v1.0)

3. **Profile-guided optimization**:
   - Before optimization: `cargo flamegraph`
   - Identify hot spots
   - Optimize, re-profile
   - Verify improvement

---

## Documented Results (After v1.0 Testing)

Update this section after running full benchmark:

```
### v1.0 Final Results

Date: [When benchmark run]
System: [CPU, RAM, OS]
Test Batch: 100 JPEGs, 3000×2000px each

**Export Speed**
- Total time: XX seconds
- Per photo: XX seconds
- Status: PASS / WARN / FAIL

**Preview Speed**
- Framed preview (10 samples): XX ms average
- Status: PASS / WARN / FAIL

**Memory Peak**
- Peak memory: XX MB
- Status: PASS / WARN / FAIL

**Gallery Scroll**
- Average FPS: XX
- Frame time: XX ms
- Status: PASS / WARN / FAIL

**Overall Status**: ✅ READY FOR v1.0 RELEASE
```

---

## Troubleshooting Performance Issues

### If export is slow (> 0.15s/photo)
1. Check CPU usage: is rayon maxed out?
2. Check disk I/O: is write slow?
3. Profile with flamegraph: `cargo flamegraph --bin magnet -- --example-args`
4. Likely causes:
   - Disk write bottleneck → output to faster drive
   - Image decoding slow → use faster decoder
   - Frame compositing slow → optimize alpha blending
   - XMP processing slow → cache parsed XMP

### If preview is slow (> 500ms)
1. Check if preview being re-generated (not cached)
2. Check if frame PNGs loaded each time (should be pre-loaded)
3. Profile Rust code with `cargo flamegraph`
4. Likely causes:
   - Frame PNGs not pre-cached → implement pre-load
   - Crop computation expensive → optimize algorithm
   - Frame compositing slow → use SIMD or caching

### If memory peak too high (> 500MB)
1. Check rayon concurrency: should be ≤ 4
2. Monitor per-photo memory decay: should drop to ~0 after processing
3. Check for memory leaks: valgrind or Tauri profiler
4. Likely causes:
   - Decoded images not dropped → ensure Drop impl
   - Thumbnail cache too large → limit size or LRU eviction
   - Rayon batch size too large → reduce pool size

### If gallery scroll janky (FPS < 58)
1. Check thumbnail sizes: 256px should be fast to render
2. Inspect CSS: are selectors efficient?
3. Check if virtual list row height correct
4. Use React DevTools Profiler to find slow renders
5. Likely causes:
   - Thumbnail re-rendering on scroll → memoize
   - CSS reflow on scroll → use CSS transforms
   - Virtual list misconfigured → tune row/column size

---

## Sign-Off (When Complete)

**Benchmark Conducted By**: [Name]
**Date**: [Date]
**System**: [Specs]
**All Targets Met**: [ ] Yes [ ] No

If no, list outstanding issues:
- [ ] Issue 1
- [ ] Issue 2

**Approved for v1.0 Release**: [ ] Yes [ ] No (specify why if no)

