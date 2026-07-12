use std::sync::Arc;
use tauri::State;

use crate::BackendState;
use crate::Error;

/// Waits for the embedded database to finish starting and returns whether it
/// succeeded. The frontend uses this to show a splash screen instead of a
/// login form that cannot do anything until PostgreSQL is ready.
#[tauri::command(rename_all = "snake_case")]
pub async fn wait_for_backend(
    backend: State<'_, Arc<BackendState>>,
) -> Result<bool, Error> {
    backend.ready().await?;
    Ok(true)
}
