//! Tiny JSON file helpers shared by the on-disk caches (events, session,
//! entitlement) so each call site doesn't re-implement read+parse / mkdir+write.

use anyhow::{Context, Result};
use serde::{de::DeserializeOwned, Serialize};
use std::path::Path;

/// Read and deserialize a JSON file.
pub fn load_json<T: DeserializeOwned>(path: &Path) -> Result<T> {
    let data = std::fs::read_to_string(path)
        .with_context(|| format!("reading {}", path.display()))?;
    serde_json::from_str(&data).with_context(|| format!("deserializing {}", path.display()))
}

/// Serialize `value` to pretty JSON, creating parent directories as needed.
///
/// Writes to a `.tmp` sibling first, then renames atomically so a crash
/// mid-write never leaves a truncated or zero-byte file.
pub fn save_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let data = serde_json::to_string_pretty(value)?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, &data).with_context(|| format!("writing {}", tmp.display()))?;
    std::fs::rename(&tmp, path)
        .with_context(|| format!("renaming {} -> {}", tmp.display(), path.display()))?;
    Ok(())
}
