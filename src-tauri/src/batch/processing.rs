use std::path::{Path, PathBuf};
use image::{DynamicImage, GenericImageView};
use rayon::prelude::*;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum BatchError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Image error: {0}")]
    Image(#[from] image::ImageError),
    #[error("Processing error: {0}")]
    Processing(String),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Orientation {
    Landscape,
    Portrait,
}

#[derive(Debug, Clone)]
pub struct FramePreset {
    pub name: String,
    pub aspect_ratio: f32, // width / height
    pub landscape_frame_path: PathBuf,
    pub portrait_frame_path: PathBuf,
}

pub struct PhotoBatch {
    pub folder_path: PathBuf,
    pub preset: FramePreset,
}

pub struct ProcessedPhoto {
    pub original_path: PathBuf,
    pub output_path: PathBuf,
}

pub fn process_batch<F>(
    folder_path: PathBuf,
    preset: FramePreset,
    progress_callback: F,
) -> Result<Vec<ProcessedPhoto>, BatchError>
where
    F: Fn(usize, usize, &Path) + Send + Sync,
{
    let files: Vec<PathBuf> = std::fs::read_dir(&folder_path)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && is_image(path))
        .collect();

    let total = files.len();
    
    let results: Vec<Result<ProcessedPhoto, BatchError>> = files
        .par_iter()
        .enumerate()
        .map(|(index, path)| {
            let processed = process_single_photo(path, &preset)?;
            progress_callback(index + 1, total, path);
            Ok(processed)
        })
        .collect();

    results.into_iter().collect()
}

fn is_image(path: &Path) -> bool {
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "tiff")
}

fn process_single_photo(path: &Path, preset: &FramePreset) -> Result<ProcessedPhoto, BatchError> {
    let img = load_photo(path)?;
    let orientation = detect_orientation(&img);
    let frame_path = select_frame(orientation, preset);
    
    // Simulate processing
    let cropped = crop_image(img, preset.aspect_ratio)?;
    let framed = apply_frame_overlay(cropped, frame_path)?;
    
    let output_path = path.with_extension("ready.jpg"); // Simple placeholder
    export_print_ready(framed, &output_path)?;
    
    Ok(ProcessedPhoto {
        original_path: path.to_path_buf(),
        output_path,
    })
}

pub fn load_photo(path: &Path) -> Result<DynamicImage, BatchError> {
    Ok(image::open(path)?)
}

pub fn detect_orientation(img: &DynamicImage) -> Orientation {
    let (width, height) = img.dimensions();
    if width > height {
        Orientation::Landscape
    } else {
        Orientation::Portrait
    }
}

pub fn select_frame(orientation: Orientation, preset: &FramePreset) -> &Path {
    match orientation {
        Orientation::Landscape => &preset.landscape_frame_path,
        Orientation::Portrait => &preset.portrait_frame_path,
    }
}

pub fn crop_image(img: DynamicImage, target_ratio: f32) -> Result<DynamicImage, BatchError> {
    let (width, height) = img.dimensions();
    let current_ratio = width as f32 / height as f32;
    
    let (new_width, new_height) = if current_ratio > target_ratio {
        // Too wide, crop width
        let new_w = (height as f32 * target_ratio) as u32;
        (new_w, height)
    } else {
        // Too tall, crop height
        let new_h = (width as f32 / target_ratio) as u32;
        (width, new_h)
    };
    
    let x = (width - new_width) / 2;
    let y = (height - new_height) / 2;
    
    Ok(img.crop_imm(x, y, new_width, new_height))
}

pub fn apply_frame_overlay(cropped: DynamicImage, _frame_path: &Path) -> Result<DynamicImage, BatchError> {
    // In a real app, we would load the frame and overlay it.
    // For this prototype, we'll just return the cropped image as a placeholder.
    Ok(cropped)
}

pub fn export_print_ready(framed: DynamicImage, output_path: &Path) -> Result<(), BatchError> {
    framed.save(output_path)?;
    Ok(())
}
