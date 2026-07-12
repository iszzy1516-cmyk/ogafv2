use std::sync::Arc;
use tauri::State;

use crate::auth;
use crate::BackendState;
use crate::models::{AuthSession, LoginCredentials, User};
use crate::Error;

#[derive(Debug, serde::Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn login(
    backend: State<'_, Arc<BackendState>>,
    credentials: LoginCredentials,
) -> Result<AuthSession, Error> {
    let db = backend.db().await?;
    let (token, user) = auth::authenticate(db.pool(), credentials).await?;
    Ok(AuthSession { token, user })
}

#[tauri::command(rename_all = "snake_case")]
pub async fn logout(
    backend: State<'_, Arc<BackendState>>,
    token: String,
) -> Result<(), Error> {
    let db = backend.db().await?;
    auth::invalidate_session(db.pool(), &token).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_current_user(
    backend: State<'_, Arc<BackendState>>,
    token: String,
) -> Result<User, Error> {
    auth::extract_user(&backend, &token).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn change_password(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    request: ChangePasswordRequest,
) -> Result<(), Error> {
    let user = auth::extract_user(&backend, &token).await?;
    let db = backend.db().await?;

    if !auth::verify_password(&request.current_password, &user.password_hash)? {
        return Err(Error::Unauthorized);
    }

    auth::change_password(db.pool(), user.id, &request.new_password).await
}
