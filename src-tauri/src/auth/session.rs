use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// A Supabase auth session. The refresh token is the long-lived secret used to
/// mint new access tokens; it is per-user, not device-bound.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub access_token: String,
    pub refresh_token: String,
    /// Unix timestamp (seconds) at which `access_token` expires.
    pub expires_at: i64,
    /// Supabase user id (`sub` claim of the verified JWT).
    pub user_id: String,
}

/// Load the cached session from `session.json`. `None` if missing/unparseable.
pub fn load_cached(path: &Path) -> Option<Session> {
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

/// Persist the session to `session.json`.
pub fn save_cached(path: &Path, session: &Session) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let data = serde_json::to_string_pretty(session)?;
    std::fs::write(path, data)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_round_trip() {
        let dir = std::env::temp_dir().join(format!("magnet-sess-{}", uuid::Uuid::new_v4()));
        let path = dir.join("session.json");
        let s = Session {
            access_token: "at".into(),
            refresh_token: "rt".into(),
            expires_at: 1_900_000_000,
            user_id: "uid".into(),
        };
        save_cached(&path, &s).unwrap();
        let loaded = load_cached(&path).unwrap();
        assert_eq!(loaded.refresh_token, "rt");
        assert_eq!(loaded.user_id, "uid");
        assert_eq!(loaded.expires_at, 1_900_000_000);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
