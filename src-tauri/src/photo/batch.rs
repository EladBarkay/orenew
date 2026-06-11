use anyhow::Result;
use crate::project::model::{Photo, FramePreset};
use crate::photo::{loader, orientation, crop, frame};

/// Frame a photo pre-scaled to canvas slot dimensions for fast export.
/// Pass frame images that are already resized to (slot_w, slot_h) — they won't be
/// re-read from disk or re-scaled per photo.
pub fn frame_photo_for_canvas(
    photo: &Photo,
    preset: &FramePreset,
    slot_w: u32,
    slot_h: u32,
    landscape_frame: &image::DynamicImage,
    portrait_frame: &image::DynamicImage,
) -> Result<image::DynamicImage> {
    let loaded = loader::load_photo(&photo.path)?;
    let orient = orientation::detect_orientation(photo);
    let frame_img = match orient {
        crate::project::model::Orientation::Landscape => landscape_frame,
        crate::project::model::Orientation::Portrait => portrait_frame,
    };
    let crop_rect = photo.crop_override.unwrap_or_else(|| {
        crop::compute_crop_rect(
            loaded.image.width(),
            loaded.image.height(),
            preset.target_ratio(),
            preset.crop_method,
        )
    });
    let cropped = crop::apply_crop(&loaded.image, crop_rect);
    // Scale to slot dimensions before compositing — works on ~1–2MP instead of ~20MP
    let scaled = cropped.resize_exact(slot_w, slot_h, image::imageops::FilterType::Triangle);
    frame::apply_frame_overlay_image(&scaled, frame_img)
}
