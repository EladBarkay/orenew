use tauri::State;
use crate::license::validator::{LicenseInfo, validate_key};
use crate::AppState;

#[tauri::command]
pub async fn validate_license(
    key: String,
    email: String,
    state: State<'_, AppState>,
) -> Result<LicenseInfo, String> {
    let info = validate_key(&key, &email).map_err(|e| e.to_string())?;
    // Persist validated license
    let path = state.app_data_dir.join("license.json");
    let data = serde_json::to_string_pretty(&info).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(info)
}

#[tauri::command]
pub async fn get_license_info(state: State<'_, AppState>) -> Result<Option<LicenseInfo>, String> {
    let path = state.app_data_dir.join("license.json");
    if !path.exists() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let info: LicenseInfo = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    // Re-check expiry
    if info.expiry < chrono::Local::now().date_naive() {
        return Ok(None);
    }
    Ok(Some(info))
}
