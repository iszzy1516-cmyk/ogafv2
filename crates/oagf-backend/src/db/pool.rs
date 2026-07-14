use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;
use std::path::PathBuf;

pub struct DbState {
    pool: PgPool,
    base_dir: PathBuf,
}

impl DbState {
    pub async fn new(base_dir: PathBuf) -> Result<Self, crate::Error> {
        std::fs::create_dir_all(&base_dir)
            .map_err(|e| crate::Error::Internal(format!("Failed to create data directory {}: {e}", base_dir.display())))?;

        // Verify the directory is actually writable before writing photos/exports/backups there.
        let test_file = base_dir.join(".write_test");
        match std::fs::write(&test_file, b"1") {
            Ok(_) => {
                let _ = std::fs::remove_file(&test_file);
            }
            Err(e) => {
                return Err(crate::Error::Internal(format!(
                    "Data directory {} is not writable: {e}",
                    base_dir.display()
                )));
            }
        }

        let operator_configured = std::env::var("DATABASE_URL").ok();
        let database_url = operator_configured
            .clone()
            .unwrap_or_else(|| "postgres://postgres:postgres@localhost:5432/oagf_pension".to_string());

        // When the operator hasn't pointed us at a specific database, we manage
        // our own bundled local PostgreSQL instance so end users never need to
        // install one themselves.
        if operator_configured.is_none() {
            crate::db::embedded::ensure_local_postgres(&base_dir).await?;
        }

        let options: PgConnectOptions = database_url
            .parse()
            .map_err(|e| crate::Error::Database(format!("Invalid DATABASE_URL: {e}")))?;

        log::info!("Connecting to PostgreSQL");

        let pool = PgPoolOptions::new()
            .max_connections(10)
            // A freshly-started embedded Postgres can take a few extra seconds
            // beyond `start()` returning before it accepts connections (e.g.
            // under AV-scanning load on first run), so this needs more room
            // than a typical already-running Postgres would need.
            .acquire_timeout(std::time::Duration::from_secs(30))
            .connect_with(options)
            .await
            .map_err(|e| {
                if operator_configured.is_some() {
                    crate::Error::Database(format!(
                        "Failed to connect to the configured PostgreSQL database. \
                        Please ensure it is reachable. Error: {e}"
                    ))
                } else {
                    crate::Error::Database(format!("Failed to start the local database: {e}"))
                }
            })?;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .map_err(|e| crate::Error::Database(format!("Migration failed: {e}")))?;

        Ok(DbState { pool, base_dir })
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub fn base_dir(&self) -> PathBuf {
        self.base_dir.clone()
    }

    pub async fn storage_info(&self) -> Result<StorageInfo, crate::Error> {
        let db_size: i64 = sqlx::query_scalar("SELECT pg_database_size(current_database())")
            .fetch_one(self.pool())
            .await
            .map_err(|e| crate::Error::Database(e.to_string()))?;

        let total_records: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners")
            .fetch_one(self.pool())
            .await
            .map_err(|e| crate::Error::Database(e.to_string()))?;

        let photos_dir = crate::db::photos_dir(self.base_dir());
        let photo_folder_size = crate::fs::dir_size(&photos_dir).unwrap_or(0);

        Ok(StorageInfo {
            db_size,
            photo_folder_size,
            total_records,
        })
    }

    pub async fn close(&self) {
        self.pool.close().await;
    }
}

#[derive(Debug, serde::Serialize)]
pub struct StorageInfo {
    pub db_size: i64,
    pub photo_folder_size: u64,
    pub total_records: i64,
}
