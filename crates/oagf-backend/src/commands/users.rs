use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::audit::{AuditEvent, log_event};
use crate::auth::{self, extract_user, require_role};
use crate::BackendState;
use crate::models::{CreateUserRequest, Role, UpdateUserRequest, User};
use crate::Error;

#[tauri::command(rename_all = "snake_case")]
pub async fn list_users(
    backend: State<'_, Arc<BackendState>>,
    token: String,
) -> Result<Vec<User>, Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin])?;
    let db = backend.db().await?;
    auth::list_users(db.pool()).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_user(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    data: CreateUserRequest,
) -> Result<UserCreatedResponse, Error> {
    let admin = extract_user(&backend, &token).await?;
    require_role(&admin, &[Role::Admin])?;
    let db = backend.db().await?;

    let (user, temp_password) = auth::create_user(
        db.pool(),
        &data.full_name,
        &data.username,
        data.role,
        Some(admin.id),
    )
    .await?;

    log_event(
        db.pool(),
        AuditEvent {
            user_id: admin.id,
            user_name: admin.full_name.clone(),
            action: "CREATE".into(),
            table_name: Some("users".into()),
            record_id: Some(user.id),
            old_values: None,
            new_values: Some(serde_json::json!({
                "username": user.username,
                "role": user.role.to_string(),
                "full_name": user.full_name,
            })),
        },
    )
    .await?;

    Ok(UserCreatedResponse { user, temp_password })
}

#[derive(Debug, serde::Serialize)]
pub struct UserCreatedResponse {
    pub user: User,
    pub temp_password: String,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn update_user(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    id: Uuid,
    data: UpdateUserRequest,
) -> Result<User, Error> {
    let admin = extract_user(&backend, &token).await?;
    require_role(&admin, &[Role::Admin])?;
    let db = backend.db().await?;

    let existing = auth::get_user_by_id(db.pool(), id).await?;
    if id == admin.id && data.is_active == Some(false) {
        return Err(Error::Validation("Cannot deactivate your own account".into()));
    }

    let old_values = serde_json::to_value(&existing).unwrap_or_default();
    let updated = auth::update_user(db.pool(), id, data).await?;

    log_event(
        db.pool(),
        AuditEvent {
            user_id: admin.id,
            user_name: admin.full_name.clone(),
            action: "UPDATE".into(),
            table_name: Some("users".into()),
            record_id: Some(id),
            old_values: Some(old_values),
            new_values: Some(serde_json::to_value(&updated).unwrap_or_default()),
        },
    )
    .await?;

    Ok(updated)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn reset_password(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    id: Uuid,
) -> Result<ResetPasswordResponse, Error> {
    let admin = extract_user(&backend, &token).await?;
    require_role(&admin, &[Role::Admin])?;
    let db = backend.db().await?;

    let temp_password = auth::reset_password(db.pool(), id).await?;

    log_event(
        db.pool(),
        AuditEvent {
            user_id: admin.id,
            user_name: admin.full_name.clone(),
            action: "UPDATE".into(),
            table_name: Some("users".into()),
            record_id: Some(id),
            old_values: None,
            new_values: Some(serde_json::json!({ "password_reset": true })),
        },
    )
    .await?;

    Ok(ResetPasswordResponse { temp_password })
}

#[derive(Debug, serde::Serialize)]
pub struct ResetPasswordResponse {
    pub temp_password: String,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_user(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    id: Uuid,
) -> Result<(), Error> {
    let admin = extract_user(&backend, &token).await?;
    require_role(&admin, &[Role::Admin])?;
    let db = backend.db().await?;

    if id == admin.id {
        return Err(Error::Validation("Cannot delete your own account".into()));
    }

    let existing = auth::get_user_by_id(db.pool(), id).await?;
    let old_values = serde_json::to_value(&existing).unwrap_or_default();

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    log_event(
        db.pool(),
        AuditEvent {
            user_id: admin.id,
            user_name: admin.full_name.clone(),
            action: "DELETE".into(),
            table_name: Some("users".into()),
            record_id: Some(id),
            old_values: Some(old_values),
            new_values: None,
        },
    )
    .await?;

    Ok(())
}
