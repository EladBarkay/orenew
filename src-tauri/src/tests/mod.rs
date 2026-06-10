#[cfg(test)]
mod tests {
    use crate::batch::processing::{process_batch, FramePreset, Orientation, detect_orientation};
    use image::{DynamicImage, RgbImage};
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn test_orientation_detection() {
        let landscape = DynamicImage::ImageRgb8(RgbImage::new(100, 50));
        let portrait = DynamicImage::ImageRgb8(RgbImage::new(50, 100));
        
        assert_eq!(detect_orientation(&landscape), Orientation::Landscape);
        assert_eq!(detect_orientation(&portrait), Orientation::Portrait);
    }
}
