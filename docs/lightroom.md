# Working from Lightroom

MagNet does **not** decode RAW files or apply Lightroom XMP edits, by design.

A Lightroom `.xmp` sidecar stores Adobe Camera Raw *parameters*, not the rendering
algorithm — only Adobe's engine (Lightroom/Photoshop) renders them faithfully. Geometry
(crop/rotate) is portable across apps, but tone/color is not (darktable and RawTherapee
have failed to match Lightroom for 15+ years). So "consume raw + sidecar and keep the
Lightroom look" is impossible for any non-Adobe app. The faithful path is to let
Lightroom do the render and hand MagNet the resulting JPEG.

## Recommended workflow

1. In **Lightroom Classic**, set up an **Export preset** (or a Hard-Drive **Publish
   Service**) whose destination is the MagNet event's source/watched folder.
2. Settings: **JPEG, sRGB, quality ~90, full resolution** (no downsize).
3. Select your edited photos → Export with that preset.
4. MagNet's file watcher auto-imports the new JPEGs — they appear in the gallery,
   ready to frame and print.

Re-exporting an edited photo overwrites the file; MagNet recomputes its `content_hash`
and resets `print_count` (re-print-on-edit), while `save_count` persists.

## Notes
- Use sRGB — MagNet outputs RGB JPEG and print/magnet labs expect sRGB.
- A Publish Service lets you "republish" updated edits with one click.
- Shooting JPEG straight off the card also works; MagNet imports those directly.
