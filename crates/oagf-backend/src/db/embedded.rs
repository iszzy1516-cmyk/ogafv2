use std::path::Path;
use std::time::Duration;

use postgresql_embedded::{PostgreSQL, Settings};

const HOST: &str = "127.0.0.1";
const PORT: u16 = 5432;
const USERNAME: &str = "postgres";
const PASSWORD: &str = "postgres";
const DATABASE_NAME: &str = "oagf_pension";

/// Ensures a local PostgreSQL server is reachable at `HOST:PORT`, starting our
/// own bundled instance if nothing is listening yet. The main and admin apps
/// share the same `base_dir`, so a cross-process file lock serializes the
/// "check reachable, init if needed, start" sequence — otherwise two apps
/// launched at once could both run `initdb` into the same data directory.
pub async fn ensure_local_postgres(base_dir: &Path) -> Result<(), crate::Error> {
    let lock_path = base_dir.join(".pg_init.lock");
    let lock_file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .open(&lock_path)
        .map_err(|e| crate::Error::Internal(format!("Failed to open PostgreSQL init lock {}: {e}", lock_path.display())))?;
    let mut file_lock = fd_lock::RwLock::new(lock_file);
    // Blocks until the other app (if any) finishes its own init/start. Bounded
    // by that process's own startup time, which is rare and short enough that
    // holding a std lock across the awaits below is an acceptable trade-off.
    let _guard = file_lock
        .write()
        .map_err(|e| crate::Error::Internal(format!("Failed to acquire PostgreSQL init lock: {e}")))?;

    if is_reachable().await {
        log::info!("Local PostgreSQL already running at {HOST}:{PORT}");
        return Ok(());
    }

    let data_dir = base_dir.join("pgdata");
    let installation_dir = base_dir.join("pgsql");
    let already_initialized = data_dir.join("PG_VERSION").exists();

    let settings = Settings {
        data_dir: data_dir.clone(),
        installation_dir,
        host: HOST.to_string(),
        port: PORT,
        username: USERNAME.to_string(),
        password: PASSWORD.to_string(),
        temporary: false,
        ..Default::default()
    };

    let mut pg = PostgreSQL::new(settings);

    if !already_initialized {
        log::info!("Initializing local PostgreSQL data directory at {}", data_dir.display());
        pg.setup()
            .await
            .map_err(|e| crate::Error::Database(format!("Failed to initialize local PostgreSQL: {e}")))?;
    }

    log::info!("Starting local PostgreSQL server");
    pg.start()
        .await
        .map_err(|e| crate::Error::Database(format!("Failed to start local PostgreSQL: {e}")))?;

    let exists = pg
        .database_exists(DATABASE_NAME)
        .await
        .map_err(|e| crate::Error::Database(format!("Failed to check for database {DATABASE_NAME}: {e}")))?;
    if !exists {
        pg.create_database(DATABASE_NAME)
            .await
            .map_err(|e| crate::Error::Database(format!("Failed to create database {DATABASE_NAME}: {e}")))?;
    }

    // `PostgreSQL`'s Drop impl stops the server. We want this instance to keep
    // running as a persistent local service shared by both apps and reused
    // across restarts, not die with this process, so its Drop must never run.
    std::mem::forget(pg);

    Ok(())
}

async fn is_reachable() -> bool {
    tokio::time::timeout(Duration::from_millis(500), tokio::net::TcpStream::connect((HOST, PORT)))
        .await
        .map(|r| r.is_ok())
        .unwrap_or(false)
}
