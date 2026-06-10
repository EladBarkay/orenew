use image::DynamicImage;
use crate::project::model::{CropMethod, CropRect};

/// Compute the crop rect that fits `target_ratio` (w/h) inside `(img_w, img_h)`.
pub fn compute_crop_rect(
    img_w: u32,
    img_h: u32,
    target_ratio: f32,
    method: CropMethod,
) -> CropRect {
    let img_ratio = img_w as f32 / img_h as f32;

    let (crop_w, crop_h) = if img_ratio > target_ratio {
        // Image is wider than target: crop width
        let h = img_h;
        let w = (h as f32 * target_ratio).round() as u32;
        (w, h)
    } else {
        // Image is taller than target: crop height
        let w = img_w;
        let h = (w as f32 / target_ratio).round() as u32;
        (w, h)
    };

    let (x, y) = match method {
        CropMethod::Center => {
            ((img_w - crop_w) / 2, (img_h - crop_h) / 2)
        }
        CropMethod::RuleOfThirds => {
            // Shift crop vertically: top edge at 1/3 from top, clamped
            let x = (img_w - crop_w) / 2;
            let third = img_h / 3;
            let y = third.saturating_sub(0).min(img_h - crop_h);
            (x, y)
        }
    };

    CropRect { x, y, width: crop_w, height: crop_h }
}

pub fn apply_crop(image: &DynamicImage, rect: CropRect) -> DynamicImage {
    image.crop_imm(rect.x, rect.y, rect.width, rect.height)
}
