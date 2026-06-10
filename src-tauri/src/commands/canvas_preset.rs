use tauri::State;
use uuid::Uuid;
use crate::project::model::CanvasPreset;
use crate::AppState;

#[tauri::command]
pub async fn list_canvas_presets(
    event_id: Uuid,
    state: State<'_, AppState>,
) -> Result<Vec<CanvasPreset>, String> {
    let event = state.store.load(event_id).map_err(|e| e.to_string())?;
    Ok(event.canvas_presets)
}

#[tauri::command]
pub async fn create_canvas_preset(
    event_id: Uuid,
    preset: CanvasPreset,
    state: State<'_, AppState>,
) -> Result<CanvasPreset, String> {
    let mut event = state.store.load(event_id).map_err(|e| e.to_string())?;
    let preset = CanvasPreset { id: Uuid::new_v4(), ..preset };
    event.canvas_presets.push(preset.clone());
    state.store.save(&event).map_err(|e| e.to_string())?;
    Ok(preset)
}

#[tauri::command]
pub async fn delete_canvas_preset(
    event_id: Uuid,
    preset_id: Uuid,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut event = state.store.load(event_id).map_err(|e| e.to_string())?;
    event.canvas_presets.retain(|p| p.id != preset_id);
    state.store.save(&event).map_err(|e| e.to_string())
}
