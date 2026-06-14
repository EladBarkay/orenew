use anyhow::{anyhow, bail, Result};
use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::sync::Mutex;
use std::time::Duration;

const SUPABASE_URL: &str = env!("SUPABASE_URL");
const TIMEOUT: Duration = Duration::from_secs(8);

/// Cached JWKS — Supabase rotates rarely, so we fetch once and refetch only if
/// verification fails (handles key rotation without a fetch on every call).
static JWKS_CACHE: Mutex<Option<JwkSet>> = Mutex::new(None);

/// Claims we care about from a Supabase access token. `exp` and `iss` are
/// validated by `jsonwebtoken` against the token itself (not read here), but are
/// kept for documentation and potential future use.
#[derive(Debug, Deserialize)]
pub struct Claims {
    /// Supabase user id.
    pub sub: String,
    /// Expiry (unix seconds).
    #[allow(dead_code)]
    pub exp: i64,
    /// Issuer — must be `{SUPABASE_URL}/auth/v1`.
    #[allow(dead_code)]
    pub iss: String,
    /// User email, when present in the token.
    #[serde(default)]
    pub email: Option<String>,
}

fn jwks_url() -> String {
    format!("{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
}

fn expected_issuer() -> String {
    format!("{SUPABASE_URL}/auth/v1")
}

async fn fetch_jwks() -> Result<JwkSet> {
    let client = reqwest::Client::builder().timeout(TIMEOUT).build()?;
    let jwks: JwkSet = client.get(jwks_url()).send().await?.json().await?;
    Ok(jwks)
}

/// Verify a Supabase access token: signature against the public JWKS, plus
/// `exp` and issuer. Returns the decoded claims on success.
pub async fn verify(token: &str) -> Result<Claims> {
    let cached = JWKS_CACHE.lock().unwrap().clone();
    let issuer = expected_issuer();

    if let Some(jwks) = cached {
        if let Ok(claims) = verify_with_jwks(token, &jwks, &issuer) {
            return Ok(claims);
        }
        // Fall through: cache may be stale (rotated key) — refetch once.
    }

    let jwks = fetch_jwks().await?;
    *JWKS_CACHE.lock().unwrap() = Some(jwks.clone());
    verify_with_jwks(token, &jwks, &issuer)
}

/// Pure verification against a provided JWKS (no network). Testable.
fn verify_with_jwks(token: &str, jwks: &JwkSet, expected_iss: &str) -> Result<Claims> {
    let header = decode_header(token)?;

    // Only accept asymmetric algorithms — guards against the "alg confusion"
    // attack where an attacker signs HS256 using the public key as the secret.
    if !matches!(header.alg, Algorithm::RS256 | Algorithm::ES256) {
        bail!("unsupported token algorithm: {:?}", header.alg);
    }

    let kid = header.kid.ok_or_else(|| anyhow!("token has no kid"))?;
    let jwk = jwks
        .find(&kid)
        .ok_or_else(|| anyhow!("no JWKS key matches kid {kid}"))?;
    let key = DecodingKey::from_jwk(jwk)?;

    let mut validation = Validation::new(header.alg);
    validation.set_issuer(&[expected_iss]);
    // Supabase tokens carry aud="authenticated"; we don't gate on it here.
    validation.validate_aud = false;

    let data = decode::<Claims>(token, &key, &validation)?;
    Ok(data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::Serialize;

    // Test RSA keypair generated for these tests only (never used in prod).
    const TEST_KID: &str = "test-key";
    const TEST_N: &str = "lkImejBKUCGvX4-HQuleBAE2wMVu8pWEmO2AyiVbu2wQlpDq1GDzaZht8K-K3jJvIG3n2izOOgvRSPWw3OnOC4dmu_9oJ1FUPV0c4WUrk7xgYlgF-S6KVXp7qfV2UYrixWeVXuD9IwtHgQyUehESm8nSp1MAfcUGF4wU47BYoOnrvMMNfPpAUKYgZKqaa0TYNFRXHk8IKcNiV3gQIX66fEwfXFA5kV4u_PdM3-4PCIAC1RzSyWdZKvRSQcnAXK-7wdTUmvivGpQ7WYz8ENsgXCE3IhWNunCUbXyONlgztQYd7bc0s7O43B6uLPJw6AjA2kbybdgubFmS5eck7ZjBgw";

    const TEST_PRIV_PEM: &str = "-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCWQiZ6MEpQIa9f
j4dC6V4EATbAxW7ylYSY7YDKJVu7bBCWkOrUYPNpmG3wr4reMm8gbefaLM46C9FI
9bDc6c4Lh2a7/2gnUVQ9XRzhZSuTvGBiWAX5LopVenup9XZRiuLFZ5Ve4P0jC0eB
DJR6ERKbydKnUwB9xQYXjBTjsFig6eu8ww18+kBQpiBkqpprRNg0VFceTwgpw2JX
eBAhfrp8TB9cUDmRXi7890zf7g8IgALVHNLJZ1kq9FJBycBcr7vB1NSa+K8alDtZ
jPwQ2yBcITciFY26cJRtfI42WDO1Bh3ttzSzs7jcHq4s8nDoCMDaRvJt2C5sWZLl
5yTtmMGDAgMBAAECggEASRXR61rzung3+i4w533lSeNhQ3CE35+USGI1Y526ObZ9
dw7z+etSWklXKFvqGtvDK63puThT8u3ulSNULI/YtcjdUpIPkhg/9j0FICj6gjh9
VThlZ2eYx6z0251WOKFqXgRdJjIfTl1dIUsCKUGGoJoRSWvY8FPV+7waKQmMgm+m
U0luZSzLtjFDs1uSlQyfGKYlPkftht19OQD8IrbeapWX+Se/R304uralIQgfwDNH
Ll/mG/qVQ+wzB90IEP+KXn37Ax4PpguFudLxbpS6cnFI/HdcsZt4sg1bztxKB8JR
Iyvzr5LFLJkCF3taSnesS/d0PK8m2pJhPw2rIxNGYQKBgQDMRm3DIeQoHA9EpiMc
mX9v8Z0Rg6ogdIHINaSGw/RU1xUhamJ8uxAJGMepY7lvTc5Htms0/RltfmmFMpld
0GBs+No4Cj8wDkjXtuMgNTtCb2OR6hyGzsVZdW3YNRDGNhRQZ18RyBxp4WObApV7
9Vor/bYF/U0XSozILHUxUWMrswKBgQC8TjyrnN+neel064g06xEUurgfwEyt9bAS
8c7emXNrcKUI1DFOTm9cp4SVFqMbObG2OU62XY+oyfKPafQQz0Y63DfVum+z15QY
MM30nOTiSszsuC7K26NPOgXIIQAKzdxxCZFlzBD0QHH9CVg6fRw+sXl2uuXkHThy
eD5BYAnq8QKBgD05FoiXTcRftIvEp11Y/ALXDVZEeebERGl2+lqRvFb5J5IeSmpL
vmCblqvEAb3EOgDwQW1eNhLFAmczZRfi7iN66hxFpe6HOXm9jJEIozwkGlmPKwGU
Uz2enk9giCh/6NK4SJwRt8JcFPhOa/L89AufPMDKzCIg69TKzkz7sZdVAoGAS8eY
dt+syfMv1lOq/tDSkOsLiguTUDadYyJYxBAw+L3eTI1IQmEiQ8FOg8kWXrB7KgAq
Aw3n8F9E9B4JkHI5qxpQhfx/U3qgKJQLbjNtkPvVODZu7kgxkoKhLQbKw45Q9lSJ
ZNQYxpLgzJnkHbWXlktJvFQ+i+yOeNKXCywhEaECgYB4U0ntIcVUSI2tAbGNJvon
dgqfg5XmXYNFsr6b9+04QZLLtuKh7tfDYMfBkXij6ntrxuy2zJL35iClmxkBw8HL
bmafjDW+6eJs2k54XbFwA3N3nEpqBgPSN7w0LVwVZnCY1rrtl/Bb57WxTiQMK70/
WU2UZtCeX+twblLKb+rsvw==
-----END PRIVATE KEY-----";

    #[derive(Serialize)]
    struct TestClaims {
        sub: String,
        exp: i64,
        iss: String,
    }

    fn test_jwks() -> JwkSet {
        let json = format!(
            r#"{{"keys":[{{"kty":"RSA","use":"sig","kid":"{TEST_KID}","alg":"RS256","n":"{TEST_N}","e":"AQAB"}}]}}"#
        );
        serde_json::from_str(&json).unwrap()
    }

    fn sign(iss: &str, exp: i64) -> String {
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(TEST_KID.to_string());
        let claims = TestClaims {
            sub: "user-123".to_string(),
            exp,
            iss: iss.to_string(),
        };
        let key = EncodingKey::from_rsa_pem(TEST_PRIV_PEM.as_bytes()).unwrap();
        encode(&header, &claims, &key).unwrap()
    }

    fn future() -> i64 {
        (chrono::Utc::now() + chrono::Duration::days(365)).timestamp()
    }

    fn past() -> i64 {
        (chrono::Utc::now() - chrono::Duration::days(1)).timestamp()
    }

    const ISS: &str = "https://test.supabase.co/auth/v1";

    #[test]
    fn valid_token_verifies() {
        let token = sign(ISS, future());
        let claims = verify_with_jwks(&token, &test_jwks(), ISS).unwrap();
        assert_eq!(claims.sub, "user-123");
    }

    #[test]
    fn expired_token_rejected() {
        let token = sign(ISS, past());
        assert!(verify_with_jwks(&token, &test_jwks(), ISS).is_err());
    }

    #[test]
    fn wrong_issuer_rejected() {
        let token = sign("https://evil.example.com/auth/v1", future());
        assert!(verify_with_jwks(&token, &test_jwks(), ISS).is_err());
    }
}
