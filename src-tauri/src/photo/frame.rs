use std::path::Path;
use anyhow::{Context, Result};
use image::{DynamicImage, GenericImageView};

/// Alpha-composite a frame PNG (with transparency) over a cropped photo.
/// The frame is scaled to exactly match `base` dimensions.
pub fn apply_frame_overlay(base: &DynamicImage, frame_path: &Path) -> Result<DynamicImage> {
    let frame = image::open(frame_path)
        .with_context(|| format!("loading frame {}", frame_path.display()))?;

    let (w, h) = base.dimensions();
    let frame = frame.resize_exact(w, h, image::imageops::FilterType::Lanczos3);

    // Start with the photo as RGBA base
    let mut output = base.to_rgba8();

    // Overlay the frame using alpha compositing
    image::imageops::overlay(&mut output, &frame.to_rgba8(), 0, 0);

    Ok(DynamicImage::ImageRgba8(output))
}
