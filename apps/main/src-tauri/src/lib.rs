#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    oagf_backend::setup(tauri::Builder::default())
        .run(tauri::generate_context!())
        .expect("error while running OAGF Pension main application");
}
