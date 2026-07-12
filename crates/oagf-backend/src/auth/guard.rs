use std::sync::Arc;
use uuid::Uuid;

use crate::BackendState;
use crate::models::{Role, User};
use crate::Error;

pub async fn extract_user(backend: &Arc<BackendState>, token: &str) -> Result<User, Error> {
    let db = backend.db().await?;
    crate::auth::service::validate_session(db.pool(), token).await
}

pub fn require_role(user: &User, allowed: &[Role]) -> Result<(), Error> {
    if allowed.contains(&user.role) {
        Ok(())
    } else {
        Err(Error::Forbidden)
    }
}

pub fn require_admin_or_self(user: &User, target_id: Uuid) -> Result<(), Error> {
    if user.role == Role::Admin || user.id == target_id {
        Ok(())
    } else {
        Err(Error::Forbidden)
    }
}
