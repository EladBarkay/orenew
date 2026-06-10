use std::collections::HashMap;
use std::sync::mpsc;
use tauri::{Emitter, State};
use uuid::Uuid;
use crate::AppState;

#[tauri::command]
pub async fn export_batch(
    event_id: Uuid,
    batch_id: Uuid,
    canvas_preset_id: Uuid,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let event = state.store.load(event_id).map_err(|e| e.to_string())?;
    let batch = event
        .batches
        .iter()
        .find(|b| b.id == batch_id)
        .ok_or_else(|| format!("batch {batch_id} not found"))?;
    let _canvas_preset = event
        .canvas_presets
        .iter()
        .find(|p| p.id == canvas_preset_id)
        .ok_or_else(|| format!("canvas preset {canvas_preset_id} not found"))?;
    let frame_preset = event
        .active_frame_preset_id
        .and_then(|id| event.frame_presets.iter().find(|p| p.id == id))
        .ok_or("no active frame preset")?;
    let output_root = event
        .output_folder
        .as_ref()
        .ok_or("no output folder configured")?;

    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let output_dir = output_root.join(timestamp);
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

    let (tx, rx) = mpsc::channel();
    let photos = batch.photos.clone();
    let frame_preset = frame_preset.clone();
    let output_dir_clone = output_dir.clone();

    let app_clone = app.clone();
    let _total = photos.len();

    std::thread::spawn(move || {
        let job = crate::photo::batch::BatchJob {
            photos: &photos,
            frame_preset: &frame_preset,
            output_dir: &output_dir_clone,
        };
        let results = crate::photo::batch::process_batch(job, tx);
        let errors: Vec<String> = results
            .iter()
            .filter_map(|r| r.as_ref().err().map(|e| e.to_string()))
            .collect();
        let _ = app_clone.emit("export-complete", serde_json::json!({ "errors": errors }));
    });

    // Forward progress events (non-blocking — spawn a thread to drain)
    let app_clone2 = app.clone();
    std::thread::spawn(move || {
        for progress in rx {
            let _ = app_clone2.emit("export-progress", &progress);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn print_photos(
    event_id: Uuid,
    photo_ids: Vec<Uuid>,
    quantities: HashMap<Uuid, u32>,
    canvas_preset_id: Uuid,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut event = state.store.load(event_id).map_err(|e| e.to_string())?;
    let canvas_preset = event
        .canvas_presets
        .iter()
        .find(|p| p.id == canvas_preset_id)
        .ok_or_else(|| format!("canvas preset {canvas_preset_id} not found"))?
        .clone();
    let frame_preset = event
        .active_frame_preset_id
        .and_then(|id| event.frame_presets.iter().find(|p| p.id == id))
        .ok_or("no active frame preset")?
        .clone();

    // Build framed images for selected photos
    let photos: Vec<_> = event
        .batches
        .iter()
        .flat_map(|b| &b.photos)
        .filter(|p| photo_ids.contains(&p.id))
        .cloned()
        .collect();

    let mut framed = Vec::new();
    for photo in &photos {
        let loaded = crate::photo::loader::load_photo(&photo.path).map_err(|e| e.to_string())?;
        let orient = crate::photo::orientation::detect_orientation(photo);
        let frame_path = frame_preset.frame_path(orient);
        let crop_rect = photo.crop_override.unwrap_or_else(|| {
            crate::photo::crop::compute_crop_rect(
                loaded.image.width(),
                loaded.image.height(),
                frame_preset.target_ratio(),
                frame_preset.crop_method,
            )
        });
        let cropped = crate::photo::crop::apply_crop(&loaded.image, crop_rect);
        let img = crate::photo::frame::apply_frame_overlay(&cropped, frame_path)
            .map_err(|e| e.to_string())?;
        framed.push(img);
    }

    let canvases = crate::canvas::compositor::compose_canvases(&framed, &canvas_preset);

    // Save canvases to a temp dir and open print dialog
    let tmp_dir = std::env::temp_dir().join("magnet_print");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;
    for (i, canvas) in canvases.iter().enumerate() {
        let p = tmp_dir.join(format!("print_{i}.jpg"));
        crate::photo::export::export_print_ready(canvas, &p).map_err(|e| e.to_string())?;
    }

    // Increment print counts
    for batch in &mut event.batches {
        for photo in &mut batch.photos {
            if photo_ids.contains(&photo.id) {
                photo.print_count += quantities.get(&photo.id).copied().unwrap_or(1);
            }
        }
    }
    state.store.save(&event).map_err(|e| e.to_string())?;

    // TODO: open OS print dialog with tmp_dir files (requires platform-specific print plugin)
    Ok(())
}
