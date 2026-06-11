use std::path::Path;
use anyhow::{Context, Result};
use image::{DynamicImage, GenericImageView};

/// Alpha-composite a frame PNG (with transparency) over a cropped photo.
/// The frame is scaled to exactly match `base` dimensions.
pub fn apply_frame_overlay(base: &DynamicImage, frame_path: &Path) -> Result<DynamicImage> {
    let frame = image::open(frame_path)
        .with_context(|| format!("loading frame {}", frame_path.display()))?;
    apply_frame_overlay_image(base, &frame)
}

/// Same as `apply_frame_overlay` but uses an already-loaded frame image.
/// Use this in batch contexts to avoid re-reading the same frame PNG for every photo.
pub fn apply_frame_overlay_image(base: &DynamicImage, frame: &DynamicImage) -> Result<DynamicImage> {
    let (w, h) = base.dimensions();
    let frame = frame.resize_exact(w, h, image::imageops::FilterType::Triangle);
    let mut output = base.to_rgba8();
    image::imageops::overlay(&mut output, &frame.to_rgba8(), 0, 0);
    Ok(DynamicImage::ImageRgba8(output))
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    #[test]
    fn overlay_matches_base_dimensions_and_is_resized() {
        // Base 100x60, frame a different size — output must match base dims.
        let base = DynamicImage::ImageRgba8(RgbaImage::from_pixel(100, 60, Rgba([10, 20, 30, 255])));
        let frame = DynamicImage::ImageRgba8(RgbaImage::from_pixel(8, 8, Rgba([0, 0, 0, 0])));
        let out = apply_frame_overlay_image(&base, &frame).unwrap();
        assert_eq!((out.width(), out.height()), (100, 60));
    }

    #[test]
    fn fully_transparent_frame_preserves_base_pixels() {
        let base = DynamicImage::ImageRgba8(RgbaImage::from_pixel(20, 20, Rgba([200, 100, 50, 255])));
        let frame = DynamicImage::ImageRgba8(RgbaImage::from_pixel(20, 20, Rgba([0, 0, 0, 0])));
        let out = apply_frame_overlay_image(&base, &frame).unwrap().to_rgba8();
        assert_eq!(out.get_pixel(5, 5), &Rgba([200, 100, 50, 255]));
    }

    #[test]
    fn opaque_frame_covers_base_pixels() {
        let base = DynamicImage::ImageRgba8(RgbaImage::from_pixel(20, 20, Rgba([200, 100, 50, 255])));
        let frame = DynamicImage::ImageRgba8(RgbaImage::from_pixel(20, 20, Rgba([0, 0, 0, 255])));
        let out = apply_frame_overlay_image(&base, &frame).unwrap().to_rgba8();
        assert_eq!(out.get_pixel(10, 10), &Rgba([0, 0, 0, 255]));
    }
}
