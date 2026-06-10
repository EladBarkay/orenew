// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod batch;
mod exif;
mod export;
mod commands;
mod db;

use std::sync::Mutex;
use rusqlite::Connection;

fn main() {
    // In a real app, we'd use app_handle to get the app_data_dir
    // For now, we'll initialize a file in the local directory (or temp)
    let db = db::init_db(std::path::Path::new("magnet.db")).expect("Failed to init DB");
    
    tauri::Builder::default()
        .manage(Mutex::new(db))
        .invoke_handler(tauri::generate_handler![
            commands::process_photos_command,
            commands::record_print_command,
            commands::get_print_count_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
