fn main() {
    tauri_build::build();

    // Provide default dev license credentials if not set in the environment.
    if std::env::var("MAGNET_DEV_EMAIL").is_err() {
        println!("cargo:rustc-env=MAGNET_DEV_EMAIL=eladb1231@gmail.com");
    }
    if std::env::var("MAGNET_DEV_KEY").is_err() {
        println!("cargo:rustc-env=MAGNET_DEV_KEY=DEV-MAGNET-PRO");
    }
}
