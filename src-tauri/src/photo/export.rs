use std::path::Path;
use anyhow::{Context, Result};
use image::DynamicImage;

/// Write a framed image as RGB JPEG with 300 DPI metadata.
pub fn export_print_ready(image: &DynamicImage, output_path: &Path) -> Result<()> {
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let rgb = image.to_rgb8();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
        std::fs::File::create(output_path)
            .with_context(|| format!("creating {}", output_path.display()))?,
        95,
    );
    encoder
        .encode_image(&rgb)
        .with_context(|| format!("encoding JPEG to {}", output_path.display()))
}
