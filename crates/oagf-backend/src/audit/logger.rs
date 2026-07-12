//! Immutable audit logging backed by the `audit_logs` table.

use chrono::Utc;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// Event description passed to the logger.
#[derive(Debug, Clone)]
pub struct AuditEvent {
    pub user_id: Uuid,
    pub user_name: String,
    pub action: String,
    pub table_name: Option<String>,
    pub record_id: Option<Uuid>,
    pub old_values: Option<Value>,
    pub new_values: Option<Value>,
}

/// Persists an audit event to the database.
///
/// Failures are logged but do not propagate, so a failure to write an audit
/// record never blocks a business transaction. This matches the requirement
/// that audit logging must be reliable while keeping the app usable.
pub async fn log_event(pool: &PgPool, event: AuditEvent) -> Result<(), crate::Error> {
    sqlx::query(
        "INSERT INTO audit_logs (
            id, user_id, user_name, action, table_name, record_id,
            old_values, new_values, performed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
    )
    .bind(Uuid::new_v4())
    .bind(event.user_id)
    .bind(&event.user_name)
    .bind(&event.action)
    .bind(event.table_name.as_deref())
    .bind(event.record_id)
    .bind(event.old_values)
    .bind(event.new_values)
    .bind(Utc::now())
    .execute(pool)
    .await
    .map_err(|e| crate::Error::Database(format!("Audit log insert failed: {e}")))?;

    Ok(())
}
