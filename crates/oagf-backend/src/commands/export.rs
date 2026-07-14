use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::Local;
use tauri::State;

use crate::audit::{AuditEvent, log_event};
use crate::auth::{extract_user, require_role};
use crate::BackendState;
use crate::export::{export_csv as write_csv, export_excel as write_excel};
use crate::fs;
use crate::models::{ExportFilter, Role};
use crate::Error;

/// Resolves an export target path and ensures it cannot escape the intended
/// directory via `..` or symlink tricks. Empty `path` defaults to the app
/// exports directory. Returns the validated absolute path.
fn resolve_export_target(base_dir: &Path, path: &str, filename: &str) -> Result<PathBuf, Error> {
    let base = if path.trim().is_empty() {
        crate::db::exports_dir(base_dir.to_path_buf())
    } else {
        let provided = PathBuf::from(path);
        if !provided.is_absolute() {
            return Err(Error::Validation("Export path must be absolute".into()));
        }
        let normalized = fs::normalize_path(&provided);
        // Reject paths that try to escape the filesystem root.
        if normalized.components().next().is_none() {
            return Err(Error::Validation("Invalid export path".into()));
        }
        provided
    };

    let target = base.join(filename);
    // Defensive: resolve any symlinks and confirm the file sits under the base.
    let canonical_base = base.canonicalize().unwrap_or_else(|_| base.clone());
    let canonical_target = target.canonicalize().unwrap_or_else(|_| target.clone());
    if !canonical_target.starts_with(&canonical_base) {
        return Err(Error::Validation("Export target is outside the allowed directory".into()));
    }
    Ok(canonical_target)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn export_csv(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    filter: ExportFilter,
    path: String,
) -> Result<ExportResult, Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin, Role::Verifier, Role::Clerk])?;
    if filter.scope == "audit" {
        return Err(Error::Validation("CSV export for audit logs requires an admin".into()));
    }
    let db = backend.db().await?;

    let filename = generate_filename(&filter.scope, "csv");
    let target = resolve_export_target(&db.base_dir(), &path, &filename)?;
    fs::ensure_dir(target.parent().unwrap_or(Path::new(".")))?;
    let record_count = write_csv(db.pool(), &filter, &target).await?;

    log_event(
        db.pool(),
        AuditEvent {
            user_id: user.id,
            user_name: user.full_name.clone(),
            action: "EXPORT_CSV".into(),
            table_name: Some(if filter.scope == "audit" { "audit_logs".into() } else { "pensioners".into() }),
            record_id: None,
            old_values: None,
            new_values: Some(serde_json::json!({
                "filter": filter,
                "path": target.to_string_lossy(),
                "record_count": record_count,
            })),
        },
    )
    .await?;

    Ok(ExportResult { filename, record_count })
}

#[tauri::command(rename_all = "snake_case")]
pub async fn export_excel(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    filter: ExportFilter,
    path: String,
) -> Result<ExportResult, Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin, Role::Verifier, Role::Clerk])?;
    if filter.scope == "audit" {
        return Err(Error::Validation("CSV export for audit logs requires an admin".into()));
    }
    let db = backend.db().await?;

    if filter.scope == "audit" {
        return Err(Error::Validation("Excel export is not supported for audit logs".into()));
    }

    let filename = generate_filename(&filter.scope, "xlsx");
    let target = resolve_export_target(&db.base_dir(), &path, &filename)?;
    fs::ensure_dir(target.parent().unwrap_or(Path::new(".")))?;
    let record_count = write_excel(db.pool(), &filter, &target).await?;

    log_event(
        db.pool(),
        AuditEvent {
            user_id: user.id,
            user_name: user.full_name.clone(),
            action: "EXPORT_EXCEL".into(),
            table_name: Some("pensioners".into()),
            record_id: None,
            old_values: None,
            new_values: Some(serde_json::json!({
                "filter": filter,
                "path": target.to_string_lossy(),
                "record_count": record_count,
            })),
        },
    )
    .await?;

    Ok(ExportResult { filename, record_count })
}

#[derive(Debug, serde::Serialize)]
pub struct ExportResult {
    pub filename: String,
    pub record_count: usize,
}

fn generate_filename(scope: &str, ext: &str) -> String {
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    fs::sanitize_filename(&format!("oagf_{}_{}.{}", scope, timestamp, ext))
}
