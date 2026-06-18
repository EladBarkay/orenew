# Supabase setup

MagNet uses Supabase for identity (sign-in) and authorization (tier). The app
treats **Rust as the source of truth**: the frontend only drives interactive
sign-in, then hands the session to Rust, which verifies the JWT against Supabase's
public JWKS and reads the `entitlements` table itself.

This is a one-time, out-of-repo project configuration. Do it once per Supabase
project (e.g. a `staging` and a `prod` project).

## 1. Auth providers

In **Authentication → Providers**, enable:

- **Email** (email + password).
- **Google** — create an OAuth client in
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
- **Facebook** — create an app in [Meta for Developers](https://developers.facebook.com/).

> **Authorized redirect URI for Google/Meta is Supabase's own callback:**
> `https://<project-ref>.supabase.co/auth/v1/callback`.
> Google/Meta never see the `magnet://` custom scheme — that is only the final
> Supabase→app hop (configured in step 2). Paste each provider's client id +
> secret into Supabase.

## 2. Redirect allow-list

In **Authentication → URL Configuration → Redirect URLs**, add:

```
magnet://auth-callback
```

Supabase permits non-HTTP schemes here for native/desktop apps. This is where the
PKCE OAuth flow returns control to the app via `tauri-plugin-deep-link`.

## 3. JWT signing keys (asymmetric)

In **Authentication → JWT Keys** (or **Settings → JWT**), enable **asymmetric
signing keys** (ES256 / RS256). Rust verifies access tokens against the public
JWKS at `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`, so no
JWT secret is embedded in the binary.

## 4. Schema + RLS

Run [`docs/supabase/entitlements.sql`](supabase/entitlements.sql) in the SQL
editor. It creates `public.entitlements`, enables Row-Level Security so each user
can read only their own row, and adds a trigger that auto-creates a `free` row on
signup. Only the **service role** (your Stripe webhook / admin tooling) can write
a paid tier — there is no client-writable policy.

To grant someone Pro/Studio manually (e.g. for testing), run as service role:

```sql
update public.entitlements
  set tier = 'pro', expires_at = null, updated_at = now()
  where user_id = '<the-user-uuid>';
```

## 5. Config values

The anon key is public and safe to ship. Both the Rust binary and the frontend
read the same two vars from a single repo-root `.env` (see `.env.example`):

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
```

`src-tauri/build.rs` loads this `.env` via `dotenvy` and bakes the values in at
`cargo build`; Vite exposes them to the frontend via
`envPrefix: ["VITE_", "SUPABASE_"]`. A real exported shell env var overrides the
`.env` on either side.

## Dev bypass

To run at a paid tier without any sign-in, build with:

```bash
MAGNET_DEV_TIER=pro npm run tauri dev      # or studio
```

Rust seeds a synthetic Pro/Studio entitlement (sentinel session) and the
background refresh loop skips it — no network, no Supabase project needed.
