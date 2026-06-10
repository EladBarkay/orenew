use rexif;

pub fn get_orientation(path: &std::path::Path) -> Option<u32> {
    match rexif::parse_file(path.to_str().unwrap_or("")) {
        Ok(data) => {
            for entry in data.entries {
                if entry.tag == rexif::ExifTag::Orientation {
                    return Some(entry.value.to_uint());
                }
            }
            None
        }
        Err(_) => None,
    }
}
