#[cfg(test)]
mod db_tests {
    use crate::db;
    use rusqlite::Connection;

    #[test]
    fn test_print_count_tracking() {
        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&std::path::Path::new("dummy")).unwrap(); // Using dummy path is fine for memory
        
        let path = "test_photo.jpg";
        db::increment_print_count(&conn, path).unwrap();
        db::increment_print_count(&conn, path).unwrap();
        
        let count = db::get_print_count(&conn, path).unwrap();
        assert_eq!(count, 2);
    }
}
