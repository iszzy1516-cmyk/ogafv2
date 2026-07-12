pub mod audit;
pub mod auth;
pub mod commands;
pub mod db;
pub mod export;
pub mod fs;
pub mod models;

use db::DbState;
use std::{sync::Arc, time::Duration};
use tauri::Manager;
use tokio::sync::{Mutex, watch};

/// Shared handle that wraps the embedded database lifecycle.
/// Commands can await `ready()` and then access `DbState` safely.
pub struct BackendState {
    db: Mutex<Option<Arc<DbState>>>,
    ready: watch::Receiver<bool>,
    ready_sender: watch::Sender<bool>,
    init_error: Mutex<Option<String>>,
    ready_timeout: Duration,
}

impl Default for BackendState {
    fn default() -> Self {
        let (ready_sender, ready) = watch::channel(false);
        Self {
            db: Mutex::new(None),
            ready,
            ready_sender,
            init_error: Mutex::new(None),
            ready_timeout: Duration::from_secs(15),
        }
    }
}

impl BackendState {
    /// Test helper that creates a fully initialized backend backed by a real
    /// PostgreSQL database. Not intended for production use.
    #[doc(hidden)]
    pub async fn for_testing(base: std::path::PathBuf) -> Result<Arc<Self>, crate::Error> {
        let backend = Arc::new(BackendState::default());
        let db = DbState::new(base).await?;
        *backend.db.lock().await = Some(Arc::new(db));
        backend.ready_sender.send_replace(true);
        Ok(backend)
    }

    pub async fn ready(&self) -> Result<(), crate::Error> {
        let mut rx = self.ready.clone();
        if !*rx.borrow_and_update() {
            tokio::time::timeout(self.ready_timeout, rx.changed())
                .await
                .map_err(|_| crate::Error::Internal(format!("Backend initialization timed out after {:?}", self.ready_timeout)))?
                .map_err(|_| crate::Error::Internal("Backend ready channel closed".into()))?;
        }
        if let Some(err) = self.init_error.lock().await.as_ref() {
            return Err(crate::Error::Internal(err.clone()));
        }
        Ok(())
    }

    pub async fn db(&self) -> Result<Arc<DbState>, crate::Error> {
        self.ready().await?;
        let guard = self.db.lock().await;
        match guard.as_ref() {
            Some(db) => Ok(Arc::clone(db)),
            None => Err(crate::Error::Internal("Database is not available".into())),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("unauthorized")]
    Unauthorized,
    #[error("forbidden")]
    Forbidden,
    #[error("not found")]
    NotFound,
    #[error("database error: {0}")]
    Database(String),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Shared Tauri setup used by both the main and admin apps.
pub fn setup<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let backend = Arc::new(BackendState::default());
            handle.manage(backend.clone());

            tauri::async_runtime::spawn(async move {
                let base = data_dir();
                log::info!("OAGF data directory: {}", base.display());
                match DbState::new(base).await {
                    Ok(db) => {
                        // Create a default admin if the database is empty.
                        match crate::auth::ensure_default_users(db.pool()).await {
                            Ok(created) if !created.is_empty() => {
                                for (username, password) in created {
                                    log::warn!(
                                        "FIRST-RUN SETUP: default user created. username={} password={}",
                                        username, password
                                    );
                                }
                                *backend.db.lock().await = Some(Arc::new(db));
                                backend.ready_sender.send_replace(true);
                                log::info!("OAGF backend initialized successfully");
                            }
                            Ok(_) => {
                                *backend.db.lock().await = Some(Arc::new(db));
                                backend.ready_sender.send_replace(true);
                                log::info!("OAGF backend initialized successfully");
                            }
                            Err(e) => {
                                let msg = format!("Failed to create default users: {e}");
                                log::error!("{msg}");
                                *backend.init_error.lock().await = Some(msg);
                                backend.ready_sender.send_replace(true);
                            }
                        }
                    }
                    Err(e) => {
                        let msg = format!("Failed to initialize OAGF backend: {e}");
                        log::error!("{msg}");
                        *backend.init_error.lock().await = Some(msg);
                        backend.ready_sender.send_replace(true);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::wait_for_backend,
            commands::auth::login,
            commands::auth::logout,
            commands::auth::get_current_user,
            commands::auth::change_password,
            commands::pensioners::create_pensioner,
            commands::pensioners::get_pensioner,
            commands::pensioners::list_pensioners,
            commands::pensioners::update_pensioner,
            commands::pensioners::verify_pensioner,
            commands::pensioners::reject_pensioner,
            commands::pensioners::delete_pensioner,
            commands::users::list_users,
            commands::users::create_user,
            commands::users::update_user,
            commands::users::reset_password,
            commands::users::delete_user,
            commands::audit::list_audit_logs,
            commands::dashboard::get_dashboard_stats,
            commands::export::export_csv,
            commands::export::export_excel,
            commands::backup::storage_info,
            commands::photos::save_photo,
            commands::photos::list_cameras,
            commands::photos::capture_photo,
            commands::photos::get_photos_dir,
        ])
}

/// Returns the canonical OAGF data directory for the current platform.
/// Both apps use this path so they share photos, exports, and backups.
/// The PostgreSQL database is configured separately via `DATABASE_URL`.
pub fn data_dir() -> std::path::PathBuf {
    let base = if cfg!(target_os = "windows") {
        std::env::var("LOCALAPPDATA")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| {
                let home = dirs::home_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")));
                home.join("AppData").join("Local")
            })
    } else {
        // Respect XDG_DATA_HOME, then fall back to ~/.local/share, then current dir.
        std::env::var("XDG_DATA_HOME")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| {
                let home = dirs::home_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")));
                home.join(".local").join("share")
            })
    };
    base.join("OAGF_Pension")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_dir_is_absolute() {
        let dir = data_dir();
        assert!(dir.is_absolute());
        assert!(dir.to_string_lossy().contains("OAGF_Pension"));
    }

    #[tokio::test]
    async fn ready_returns_immediately_when_backend_is_already_ready() {
        let backend = BackendState::default();
        backend.ready_sender.send_replace(true);

        let result = tokio::time::timeout(std::time::Duration::from_millis(100), backend.ready()).await;

        assert!(result.is_ok(), "backend readiness should not hang");
        assert!(result.unwrap().is_ok());
    }

    #[tokio::test]
    async fn ready_returns_error_when_backend_never_becomes_ready() {
        let backend = BackendState::default();
        let result = tokio::time::timeout(std::time::Duration::from_millis(100), backend.ready()).await;

        assert!(result.is_ok(), "backend readiness should fail fast");
        assert!(matches!(result.unwrap(), Err(crate::Error::Internal(_))));
    }
}
