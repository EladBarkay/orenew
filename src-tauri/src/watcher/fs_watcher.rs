use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use anyhow::Result;

pub enum WatchEvent {
    PhotoAdded(PathBuf),
    PhotoChanged(PathBuf),
    FrameChanged(PathBuf),
}

pub struct FsWatcher {
    _watcher: RecommendedWatcher,
}

impl FsWatcher {
    pub fn new<F>(callback: F) -> Result<Self>
    where
        F: Fn(WatchEvent) + Send + Sync + 'static,
    {
        let watched_frames: Arc<Mutex<Vec<PathBuf>>> = Arc::new(Mutex::new(Vec::new()));
        let frames_ref = Arc::clone(&watched_frames);
        let cb = Arc::new(callback);

        let watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
            let Ok(event) = res else { return };
            let paths = event.paths;
            for path in paths {
                let is_frame = frames_ref
                    .lock()
                    .map(|f| f.contains(&path))
                    .unwrap_or(false);

                if is_frame {
                    if matches!(event.kind, EventKind::Modify(_)) {
                        cb(WatchEvent::FrameChanged(path));
                    }
                } else if crate::photo::loader::is_supported_image(&path) {
                    match event.kind {
                        EventKind::Create(_) => cb(WatchEvent::PhotoAdded(path)),
                        EventKind::Modify(_) => cb(WatchEvent::PhotoChanged(path)),
                        _ => {}
                    }
                } else if path.extension().and_then(|e| e.to_str()) == Some("xmp") {
                    cb(WatchEvent::PhotoChanged(path));
                }
            }
        })?;

        Ok(Self { _watcher: watcher })
    }

    pub fn watch_dir(&mut self, path: &Path) -> Result<()> {
        self._watcher.watch(path, RecursiveMode::NonRecursive)?;
        Ok(())
    }

    pub fn watch_frame(&mut self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            self._watcher.watch(parent, RecursiveMode::NonRecursive)?;
        }
        Ok(())
    }
}
