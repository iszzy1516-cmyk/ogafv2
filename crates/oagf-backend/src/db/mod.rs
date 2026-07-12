pub mod pool;

use std::path::PathBuf;

pub use pool::{DbState, StorageInfo};

/// Returns the path to the photos directory.
pub fn photos_dir(base: PathBuf) -> PathBuf {
    base.join("photos")
}

/// Returns the path to the exports directory.
pub fn exports_dir(base: PathBuf) -> PathBuf {
    base.join("exports")
}

/// Returns the path to the backups directory.
pub fn backups_dir(base: PathBuf) -> PathBuf {
    base.join("backups")
}
