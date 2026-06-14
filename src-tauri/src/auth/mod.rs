pub mod session;
pub mod jwt;
pub mod entitlement;
pub mod client;

/// Bundled auth state held in memory: the active Supabase session plus the
/// resolved entitlement. `None` in `AppState.auth` => Free tier.
#[derive(Debug, Clone)]
pub struct AuthState {
    pub session: session::Session,
    pub entitlement: entitlement::Entitlement,
}

impl AuthState {
    /// Sentinel session used by the compile-time dev bypass. The background
    /// refresh loop skips any session whose refresh token equals this value.
    pub const DEV_REFRESH_TOKEN: &'static str = "dev-bypass";

    pub fn is_dev(&self) -> bool {
        self.session.refresh_token == Self::DEV_REFRESH_TOKEN
    }
}
