use std::sync::Arc;

use tauri::State;

use crate::auth::{extract_user, require_role};
use crate::db::StorageInfo;
use crate::BackendState;
use crate::models::Role;
use crate::Error;

#[tauri::command(rename_all = "snake_case")]
pub async fn storage_info(
    backend: State<'_, Arc<BackendState>>,
    token: String,
) -> Result<StorageInfo, Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin])?;
    let db = backend.db().await?;
    db.storage_info().await
}
