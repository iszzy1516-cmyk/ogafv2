//! Local filesystem operations for photos, exports and backups.

use std::path::{Path, PathBuf};

/// Ensures a directory exists, creating it recursively if necessary.
pub fn ensure_dir(path: &Path) -> Result<(), crate::Error> {
    std::fs::create_dir_all(path)
        .map_err(|e| crate::Error::Internal(format!("Failed to create directory {}: {e}", path.display())))
}

/// Writes `bytes` to `dir/filename`, creating the directory if needed.
/// Returns the absolute path written.
pub fn save_file(dir: &Path, filename: &str, bytes: &[u8]) -> Result<PathBuf, crate::Error> {
    ensure_dir(dir)?;
    let path = dir.join(sanitize_filename(filename));
    std::fs::write(&path, bytes)
        .map_err(|e| crate::Error::Internal(format!("Failed to write file {}: {e}", path.display())))?;
    Ok(path)
}

/// Validates that `bytes` looks like a JPEG and is no larger than `max_bytes`.
/// Returns the detected extension (always "jpg" for JPEG).
pub fn validate_photo(bytes: &[u8], max_bytes: usize) -> Result<&'static str, crate::Error> {
    if bytes.len() > max_bytes {
        return Err(crate::Error::Validation(format!(
            "Photo exceeds maximum size of {} MB",
            max_bytes / 1_000_000
        )));
    }
    if bytes.len() < 3 {
        return Err(crate::Error::Validation("Photo file is too small".into()));
    }
    // JPEG magic bytes: FF D8 FF
    if bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        Ok("jpg")
    } else {
        Err(crate::Error::Validation("Only JPEG photos are supported".into()))
    }
}

/// Saves a validated photo under the given base directory.
/// `preferred_name` should be a UUID-based value with no extension.
pub fn save_photo(base_dir: &Path, preferred_name: &str, bytes: &[u8]) -> Result<PathBuf, crate::Error> {
    validate_photo(bytes, 5 * 1_024 * 1_024)?; // 5 MB cap
    let photos_dir = base_dir.join("photos");
    let filename = format!("{}.jpg", sanitize_filename(preferred_name));
    save_file(&photos_dir, &filename, bytes)
}

/// Removes a single file if it exists. Errors are swallowed.
pub fn remove_file_quiet(path: &Path) {
    let _ = std::fs::remove_file(path);
}

/// Calculates the total size of `dir` in bytes by walking its contents.
pub fn dir_size(dir: &Path) -> Result<u64, crate::Error> {
    if !dir.exists() {
        return Ok(0);
    }

    let mut total: u64 = 0;
    for entry in walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        total += entry.metadata().map(|m| m.len()).unwrap_or(0);
    }
    Ok(total)
}

/// Normalizes a path by resolving `.` and `..` components without requiring
/// the path to exist. Does NOT resolve symlinks; use `canonicalize` for that.
pub fn normalize_path(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::Normal(c) => result.push(c),
            std::path::Component::ParentDir => {
                let _ = result.pop();
            }
            _ => {}
        }
    }
    result
}

/// Strips dangerous characters from a filename, keeping alphanumeric,
/// dashes, underscores and dots. Path-separator-like runs are collapsed.
pub fn sanitize_filename(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect::<String>()
        .replace("..", "")
}

/// Formats a byte count as human-readable string.
pub fn human_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit = UNITS[0];
    for u in UNITS {
        if size < 1024.0 {
            unit = u;
            break;
        }
        size /= 1024.0;
    }
    format!("{:.2} {}", size, unit)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_jpeg_magic() {
        let jpeg = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        assert_eq!(validate_photo(&jpeg, 100).unwrap(), "jpg");
    }

    #[test]
    fn rejects_non_jpeg() {
        let not_jpeg = vec![0x89, 0x50, 0x4E, 0x47];
        assert!(validate_photo(&not_jpeg, 100).is_err());
    }

    #[test]
    fn sanitizes_path_traversal() {
        assert_eq!(sanitize_filename("../../etc/passwd"), "etcpasswd");
    }
}
