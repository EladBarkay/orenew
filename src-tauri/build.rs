fn main() {
    tauri_build::build();

    // Load the repo-root .env so backend and frontend share one source of truth
    // for SUPABASE_URL / SUPABASE_ANON_KEY (the frontend reads the same file via
    // Vite). A real shell env var still wins — dotenvy does not overwrite.
    dotenvy::from_path("../.env").ok();
    println!("cargo:rerun-if-changed=../.env");

    // Supabase project config baked in at compile time so `env!()` resolves in
    // any build. The anon key is public (safe to ship). We always re-emit via
    // rustc-env because dotenvy only populates this build script's environment,
    // not the rustc process that compiles the crate's `env!()`.
    let url = std::env::var("SUPABASE_URL")
        .unwrap_or_else(|_| "https://YOUR_PROJECT_REF.supabase.co".to_string());
    println!("cargo:rustc-env=SUPABASE_URL={url}");
    let anon_key = std::env::var("SUPABASE_ANON_KEY")
        .unwrap_or_else(|_| "YOUR_SUPABASE_ANON_KEY".to_string());
    println!("cargo:rustc-env=SUPABASE_ANON_KEY={anon_key}");

    // MAGNET_DEV_TIER is intentionally NOT given a default — it's read via
    // `option_env!`, so an unset value means "no dev bypass".
    println!("cargo:rerun-if-env-changed=SUPABASE_URL");
    println!("cargo:rerun-if-env-changed=SUPABASE_ANON_KEY");
    println!("cargo:rerun-if-env-changed=MAGNET_DEV_TIER");
}
