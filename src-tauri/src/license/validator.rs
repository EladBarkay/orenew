use anyhow::{bail, Result};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use serde::{Deserialize, Serialize};
use chrono::NaiveDate;

type HmacSha256 = Hmac<Sha256>;

// Secret injected at compile time via MAGNET_LICENSE_SECRET env var.
// Falls back to a dev placeholder if not set.
const LICENSE_SECRET: &str = match option_env!("MAGNET_LICENSE_SECRET") {
    Some(s) => s,
    None => "dev-secret-change-in-prod",
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    Free,
    Pro,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub email: String,
    pub expiry: NaiveDate,
    pub tier: Tier,
}

/// Validate a license key against email.
/// Key format: `MAGNET-{BASE32(HMAC-SHA256(payload, SECRET))}`
/// where payload = `{email}|{expiry_iso}|{tier}`.
pub fn validate_key(key: &str, email: &str) -> Result<LicenseInfo> {
    let stripped = key
        .strip_prefix("MAGNET-")
        .ok_or_else(|| anyhow::anyhow!("invalid key format"))?;

    let decoded = base32::decode(base32::Alphabet::Rfc4648 { padding: false }, stripped)
        .ok_or_else(|| anyhow::anyhow!("key base32 decode failed"))?;

    // Last 32 bytes are HMAC; preceding bytes are payload
    if decoded.len() <= 32 {
        bail!("key too short");
    }
    let (payload_bytes, expected_mac) = decoded.split_at(decoded.len() - 32);
    let payload = std::str::from_utf8(payload_bytes)?;

    // Verify HMAC
    let mut mac = HmacSha256::new_from_slice(LICENSE_SECRET.as_bytes())
        .expect("HMAC can take any key size");
    mac.update(payload_bytes);
    mac.verify_slice(expected_mac)
        .map_err(|_| anyhow::anyhow!("invalid license key"))?;

    // Parse payload: email|expiry|tier
    let parts: Vec<&str> = payload.splitn(3, '|').collect();
    if parts.len() != 3 {
        bail!("malformed key payload");
    }
    if parts[0] != email {
        bail!("email does not match license key");
    }

    let expiry = NaiveDate::parse_from_str(parts[1], "%Y-%m-%d")
        .map_err(|_| anyhow::anyhow!("invalid expiry in key"))?;

    if expiry < chrono::Local::now().date_naive() {
        bail!("license key has expired");
    }

    let tier = match parts[2] {
        "pro" => Tier::Pro,
        "free" => Tier::Free,
        other => bail!("unknown tier: {}", other),
    };

    Ok(LicenseInfo { email: email.to_string(), expiry, tier })
}
