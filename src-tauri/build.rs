fn main() {
    tauri_build::build();

    // Supabase project config baked in at compile time so `env!()` resolves in
    // any build. The anon key is public (safe to ship). Override either with a
    // real environment variable at build time.
    if std::env::var("SUPABASE_URL").is_err() {
        println!("cargo:rustc-env=SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co");
    }
    if std::env::var("SUPABASE_ANON_KEY").is_err() {
        println!("cargo:rustc-env=SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY");
    }

    // MAGNET_DEV_TIER is intentionally NOT given a default — it's read via
    // `option_env!`, so an unset value means "no dev bypass".
    println!("cargo:rerun-if-env-changed=SUPABASE_URL");
    println!("cargo:rerun-if-env-changed=SUPABASE_ANON_KEY");
    println!("cargo:rerun-if-env-changed=MAGNET_DEV_TIER");
}
