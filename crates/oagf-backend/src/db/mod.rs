pub mod pool;

use std::path::PathBuf;

pub use pool::{DbState, StorageInfo};

/// Returns the path to the photos directory.
pub fn photos_dir(base: PathBuf) -> PathBuf {
    base.join("photos")
}

/// Returns the path to the exports directory (user Downloads by default).
pub fn exports_dir(base: PathBuf) -> PathBuf {
    dirs::download_dir().unwrap_or_else(|| base.join("exports"))
}

/// Returns the path to the backups directory.
pub fn backups_dir(base: PathBuf) -> PathBuf {
    base.join("backups")
}
