use rusqlite::{params, Connection, Result};
use std::path::Path;

pub fn init_db(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS photo_stats (
            id INTEGER PRIMARY KEY,
            file_path TEXT NOT NULL UNIQUE,
            print_count INTEGER DEFAULT 0
        )",
        [],
    )?;
    Ok(conn)
}

pub fn increment_print_count(conn: &Connection, file_path: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO photo_stats (file_path, print_count) 
         VALUES (?1, 1) 
         ON CONFLICT(file_path) DO UPDATE SET print_count = print_count + 1",
        params![file_path],
    )?;
    Ok(())
}

pub fn get_print_count(conn: &Connection, file_path: &str) -> Result<i32> {
    let mut stmt = conn.prepare("SELECT print_count FROM photo_stats WHERE file_path = ?1")?;
    let count: i32 = stmt.query_row(params![file_path], |row| row.get(0))?;
    Ok(count)
}
