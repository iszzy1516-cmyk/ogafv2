use std::sync::Arc;
use tauri::State;

use crate::auth::{extract_user, require_role};
use crate::BackendState;
use crate::models::{DashboardStats, Money, Role};
use crate::Error;

#[tauri::command(rename_all = "snake_case")]
pub async fn get_dashboard_stats(
    backend: State<'_, Arc<BackendState>>,
    token: String,
) -> Result<DashboardStats, Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin])?;
    let db = backend.db().await?;

    let total_pensioners: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners")
        .fetch_one(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    let unverified_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners WHERE status = 'Unverified'")
        .fetch_one(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    let verified_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners WHERE status = 'Verified'")
        .fetch_one(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    let rejected_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners WHERE status = 'Rejected'")
        .fetch_one(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    let total_liability: Money = sqlx::query_scalar(
        "SELECT COALESCE(SUM(due_for_payment_by_oagf), 0) FROM pensioners"
    )
    .fetch_one(db.pool())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let total_paid: Money = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount_paid_by_oagf), 0) FROM pensioners"
    )
    .fetch_one(db.pool())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(DashboardStats {
        total_pensioners,
        unverified_count,
        verified_count,
        rejected_count,
        total_liability,
        total_paid,
    })
}
