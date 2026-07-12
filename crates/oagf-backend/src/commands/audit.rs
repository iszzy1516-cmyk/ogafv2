use std::sync::Arc;
use tauri::State;

use crate::auth::{extract_user, require_role};
use crate::BackendState;
use crate::models::{AuditLog, PaginatedResponse, PaginationParams, Role};
use crate::Error;

#[derive(Debug, serde::Deserialize)]
pub struct AuditFilter {
    pub action: Option<String>,
    pub user_id: Option<String>,
    pub date_from: Option<chrono::NaiveDate>,
    pub date_to: Option<chrono::NaiveDate>,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn list_audit_logs(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    filter: AuditFilter,
    pagination: PaginationParams,
) -> Result<PaginatedResponse<AuditLog>, Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin])?;
    let db = backend.db().await?;

    let page = pagination.page.max(1);
    let per_page = pagination.per_page.max(1).min(100);
    let offset = (page - 1) * per_page;

    let mut count_query = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM audit_logs WHERE 1=1");
    push_audit_filters(&mut count_query, &filter);
    let total: i64 = count_query
        .build_query_scalar()
        .fetch_one(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    let mut data_query = sqlx::QueryBuilder::new("SELECT * FROM audit_logs WHERE 1=1");
    push_audit_filters(&mut data_query, &filter);
    data_query.push(" ORDER BY performed_at DESC LIMIT ");
    data_query.push_bind(per_page);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let data: Vec<AuditLog> = data_query
        .build_query_as()
        .fetch_all(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(PaginatedResponse {
        data,
        total,
        page,
        per_page,
        total_pages: total_pages.max(1),
    })
}

#[doc(hidden)]
pub fn push_audit_filters<'a>(
    query: &mut sqlx::QueryBuilder<'a, sqlx::Postgres>,
    filter: &'a AuditFilter,
) {
    if let Some(action) = &filter.action {
        query.push(" AND action = ");
        query.push_bind(action);
    }
    if let Some(user_id) = &filter.user_id {
        query.push(" AND user_id = ");
        query.push_bind(user_id);
    }
    if let Some(from) = filter.date_from {
        query.push(" AND performed_at >= ");
        query.push_bind(from);
    }
    if let Some(to) = filter.date_to {
        query.push(" AND performed_at <= ");
        query.push_bind(to);
    }
}
