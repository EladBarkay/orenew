use tauri::{Window, command, State, Emitter};
use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::Connection;
use crate::batch::processing::{process_batch, FramePreset};
use crate::db;

#[derive(serde::Deserialize)]
pub struct FramePresetDTO {
    name: String,
    aspect_ratio: f32,
    landscape_frame_path: String,
    portrait_frame_path: String,
}

#[command]
pub async fn process_photos_command(
    window: Window,
    folder_path: String,
    preset_dto: FramePresetDTO,
) -> Result<Vec<String>, String> {
    let preset = FramePreset {
        name: preset_dto.name,
        aspect_ratio: preset_dto.aspect_ratio,
        landscape_frame_path: PathBuf::from(preset_dto.landscape_frame_path),
        portrait_frame_path: PathBuf::from(preset_dto.portrait_frame_path),
    };

    let path = PathBuf::from(folder_path);

    let progress_callback = |current: usize, total: usize, _path: &std::path::Path| {
        let _ = window.emit("progress", serde_json::json!({
            "current": current,
            "total": total,
            "file": _path.to_str().unwrap_or("unknown")
        }));
    };

    match process_batch(path, preset, progress_callback) {
        Ok(results) => Ok(results.into_iter().map(|p| p.output_path.to_string_lossy().into_owned()).collect()),
        Err(e) => Err(format!("Batch processing failed: {}", e)),
    }
}

#[command]
pub fn record_print_command(db: State<'_, Mutex<Connection>>, file_path: String) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "Failed to lock DB")?;
    db::increment_print_count(&conn, &file_path).map_err(|e| e.to_string())
}

#[command]
pub fn get_print_count_command(db: State<'_, Mutex<Connection>>, file_path: String) -> Result<i32, String> {
    let conn = db.lock().map_err(|_| "Failed to lock DB")?;
    db::get_print_count(&conn, &file_path).map_err(|e| e.to_string())
}
