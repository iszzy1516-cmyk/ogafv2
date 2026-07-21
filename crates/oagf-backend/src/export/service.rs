//! CSV and Excel export implementation.

use std::fs::File;
use std::path::Path;

use chrono::NaiveDate;
use csv::WriterBuilder;
use rust_xlsxwriter::{Format, Workbook, XlsxError};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Money;

use crate::models::{AuditLog, ExportFilter, Pensioner};
use crate::Error;

/// Dangerous CSV prefixes that can be interpreted as formulas by Excel.
const FORMULA_PREFIXES: &[char] = &['=', '+', '-', '@', '\t', '\r'];

/// Escapes a CSV cell so spreadsheet applications do not evaluate it as a formula.
pub fn sanitize_cell(value: &str) -> String {
    if value.starts_with(FORMULA_PREFIXES) {
        format!("'{}", value)
    } else {
        value.to_string()
    }
}

/// Builds a LIKE search pattern with wildcards and escapes `%`, `_`, and `\`.
fn like_pattern(input: &str) -> String {
    let escaped = input.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    format!("%{}%", escaped)
}

/// Appends parameterized WHERE conditions for a pensioner export filter.
fn push_pensioner_filters<'a>(
    query: &mut sqlx::QueryBuilder<'a, sqlx::Postgres>,
    filter: &'a ExportFilter,
) {
    match filter.scope.as_str() {
        "verified" => query.push(" AND status = 'Verified'"),
        "unverified" => query.push(" AND status = 'Unverified'"),
        "rejected" => query.push(" AND status = 'Rejected'"),
        "all" | "mda" | _ => query,
    };

    if let Some(mda) = &filter.mda {
        query.push(" AND mda_name ILIKE ");
        query.push_bind(like_pattern(mda));
        query.push(" ESCAPE '\\'");
    }
    if let Some(zone) = &filter.zone {
        query.push(" AND zone = ");
        query.push_bind(zone);
    }
    if let Some(from) = filter.date_from {
        query.push(" AND created_at >= ");
        query.push_bind(from);
    }
    if let Some(to) = filter.date_to {
        query.push(" AND created_at <= ");
        query.push_bind(to);
    }
}

/// Appends parameterized WHERE conditions for an audit-log export filter.
fn push_audit_filters<'a>(
    query: &mut sqlx::QueryBuilder<'a, sqlx::Postgres>,
    filter: &'a ExportFilter,
) {
    if let Some(from) = filter.date_from {
        query.push(" AND performed_at >= ");
        query.push_bind(from);
    }
    if let Some(to) = filter.date_to {
        query.push(" AND performed_at <= ");
        query.push_bind(to);
    }
}

fn decimal_str(d: Money) -> String {
    d.to_string()
}

fn optional_date(d: Option<NaiveDate>) -> String {
    d.map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

fn optional_dt(d: Option<chrono::DateTime<chrono::Utc>>) -> String {
    d.map(|d| d.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

fn optional_uuid(u: Option<Uuid>) -> String {
    u.map(|u| u.to_string()).unwrap_or_default()
}

/// Exports pensioners (or audit logs) matching `filter` to a CSV file at `path`.
/// Returns the number of records written.
pub async fn export_csv(pool: &PgPool, filter: &ExportFilter, path: &Path) -> Result<usize, Error> {
    crate::fs::ensure_dir(path.parent().unwrap_or(Path::new(".")))?;

    if filter.scope == "audit" {
        return export_audit_csv(pool, filter, path).await;
    }

    let mut query = sqlx::QueryBuilder::new("SELECT * FROM pensioners WHERE 1=1");
    push_pensioner_filters(&mut query, filter);
    query.push(" ORDER BY created_at DESC");
    let rows: Vec<Pensioner> = query
        .build_query_as()
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(format!("Export query failed: {e}")))?;

    let mut file = File::create(path).map_err(|e| Error::Internal(format!("Failed to create CSV: {e}")))?;
    // UTF-8 BOM for Excel, written as raw bytes -- writing it via write_record
    // would count it as a 1-field CSV row and the writer's strict field-count
    // consistency check would then reject the real (42-field) header/data rows.
    use std::io::Write as _;
    file.write_all("\u{FEFF}".as_bytes())
        .map_err(|e| Error::Internal(format!("Failed to write CSV BOM: {e}")))?;
    let mut writer = WriterBuilder::new().from_writer(file);

    writer
        .write_record(PENSIONER_HEADERS)
        .map_err(|e| Error::Internal(format!("CSV write failed: {e}")))?;

    for p in &rows {
        writer
            .write_record(pensioner_to_csv_record(p))
            .map_err(|e| Error::Internal(format!("CSV write failed: {e}")))?;
    }

    writer.flush().map_err(|e| Error::Internal(format!("CSV flush failed: {e}")))?;
    Ok(rows.len())
}

const PENSIONER_HEADERS: &[&str] = &[
    "id", "full_name", "gender", "date_of_birth", "location", "zone", "phone", "photo_path",
    "salary_structure", "mda_name", "grade", "step", "first_appointment_date",
    "last_promotion_date", "retirement_date", "years_of_service", "months_of_service",
    "apa", "gratuity", "pension", "repatriation", "total_employee_contribution_due",
    "amount_owed", "amount_owed_to_mda", "amount_paid_by_oagf",
    "ten_percent_gratuity", "ten_percent_pension", "due_for_payment_by_oagf",
    "bank_name", "account_number", "sort_code", "bank_address",
    "nok_name", "nok_phone", "nok_relation", "nok_payment",
    "status", "verified_by", "verified_at", "verification_notes",
    "created_by", "created_at", "updated_at",
];

fn pensioner_to_csv_record(p: &Pensioner) -> Vec<String> {
    vec![
        sanitize_cell(&p.id.to_string()),
        sanitize_cell(&p.full_name),
        sanitize_cell(&p.gender.clone().unwrap_or_default()),
        sanitize_cell(&optional_date(p.date_of_birth)),
        sanitize_cell(&p.location.clone().unwrap_or_default()),
        sanitize_cell(&p.zone.clone().unwrap_or_default()),
        sanitize_cell(&p.phone.clone().unwrap_or_default()),
        sanitize_cell(&p.photo_path.clone().unwrap_or_default()),
        sanitize_cell(&p.salary_structure.clone().unwrap_or_default()),
        sanitize_cell(&p.mda_name.clone().unwrap_or_default()),
        sanitize_cell(&p.grade.clone().unwrap_or_default()),
        sanitize_cell(&p.step.clone().unwrap_or_default()),
        sanitize_cell(&optional_date(p.first_appointment_date)),
        sanitize_cell(&optional_date(p.last_promotion_date)),
        sanitize_cell(&optional_date(p.retirement_date)),
        sanitize_cell(&p.years_of_service.map(|v| v.to_string()).unwrap_or_default()),
        sanitize_cell(&p.months_of_service.map(|v| v.to_string()).unwrap_or_default()),
        decimal_str(p.apa),
        decimal_str(p.gratuity),
        decimal_str(p.pension),
        decimal_str(p.repatriation),
        decimal_str(p.total_employee_contribution_due),
        decimal_str(p.amount_owed),
        decimal_str(p.amount_owed_to_mda),
        decimal_str(p.amount_paid_by_oagf),
        decimal_str(p.ten_percent_gratuity),
        decimal_str(p.ten_percent_pension),
        decimal_str(p.due_for_payment_by_oagf),
        sanitize_cell(&p.bank_name.clone().unwrap_or_default()),
        sanitize_cell(&p.account_number.clone().unwrap_or_default()),
        sanitize_cell(&p.sort_code.clone().unwrap_or_default()),
        sanitize_cell(&p.bank_address.clone().unwrap_or_default()),
        sanitize_cell(&p.nok_name.clone().unwrap_or_default()),
        sanitize_cell(&p.nok_phone.clone().unwrap_or_default()),
        sanitize_cell(&p.nok_relation.clone().unwrap_or_default()),
        if p.nok_payment { "true".into() } else { "false".into() },
        sanitize_cell(&p.status.to_string()),
        sanitize_cell(&optional_uuid(p.verified_by)),
        sanitize_cell(&optional_dt(p.verified_at)),
        sanitize_cell(&p.verification_notes.clone().unwrap_or_default()),
        sanitize_cell(&optional_uuid(p.created_by)),
        sanitize_cell(&p.created_at.format("%Y-%m-%d %H:%M:%S").to_string()),
        sanitize_cell(&p.updated_at.format("%Y-%m-%d %H:%M:%S").to_string()),
    ]
}

async fn export_audit_csv(pool: &PgPool, filter: &ExportFilter, path: &Path) -> Result<usize, Error> {
    let mut query = sqlx::QueryBuilder::new("SELECT * FROM audit_logs WHERE 1=1");
    push_audit_filters(&mut query, filter);
    query.push(" ORDER BY performed_at DESC");
    let rows: Vec<AuditLog> = query
        .build_query_as()
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(format!("Audit export query failed: {e}")))?;

    let mut file = File::create(path).map_err(|e| Error::Internal(format!("Failed to create CSV: {e}")))?;
    use std::io::Write as _;
    file.write_all("\u{FEFF}".as_bytes())
        .map_err(|e| Error::Internal(format!("Failed to write CSV BOM: {e}")))?;
    let mut writer = WriterBuilder::new().from_writer(file);
    writer
        .write_record(AUDIT_HEADERS)
        .map_err(|e| Error::Internal(format!("CSV write failed: {e}")))?;

    for r in &rows {
        writer
            .write_record(vec![
                sanitize_cell(&r.id.to_string()),
                sanitize_cell(&r.user_id.map(|u| u.to_string()).unwrap_or_default()),
                sanitize_cell(&r.user_name.clone().unwrap_or_default()),
                sanitize_cell(&r.action),
                sanitize_cell(&r.table_name.clone().unwrap_or_default()),
                sanitize_cell(&r.record_id.map(|u| u.to_string()).unwrap_or_default()),
                sanitize_cell(&r.old_values.as_ref().map(|v| v.to_string()).unwrap_or_default()),
                sanitize_cell(&r.new_values.as_ref().map(|v| v.to_string()).unwrap_or_default()),
                sanitize_cell(&r.performed_at.format("%Y-%m-%d %H:%M:%S").to_string()),
            ])
            .map_err(|e| Error::Internal(format!("CSV write failed: {e}")))?;
    }

    writer.flush().map_err(|e| Error::Internal(format!("CSV flush failed: {e}")))?;
    Ok(rows.len())
}

const AUDIT_HEADERS: &[&str] = &[
    "id", "user_id", "user_name", "action", "table_name", "record_id",
    "old_values", "new_values", "performed_at",
];

/// Exports pensioners matching `filter` to an Excel workbook at `path`.
/// Currency columns are formatted with the ₦ symbol and two decimals.
pub async fn export_excel(pool: &PgPool, filter: &ExportFilter, path: &Path) -> Result<usize, Error> {
    crate::fs::ensure_dir(path.parent().unwrap_or(Path::new(".")))?;

    let mut query = sqlx::QueryBuilder::new("SELECT * FROM pensioners WHERE 1=1");
    push_pensioner_filters(&mut query, filter);
    query.push(" ORDER BY created_at DESC");
    let rows: Vec<Pensioner> = query
        .build_query_as()
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(format!("Export query failed: {e}")))?;

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    // Currency format: ₦ symbol, thousands separator, two decimals
    let currency_format = Format::new().set_num_format("₦#,##0.00");
    let header_format = Format::new().set_bold();

    for (col, header) in PENSIONER_HEADERS.iter().enumerate() {
        worksheet
            .write_string_with_format(0, col as u16, *header, &header_format)
            .map_err(xlsx_err)?;
    }

    let currency_cols: &[usize] = &[17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];

    for (row_idx, p) in rows.iter().enumerate() {
        let row = (row_idx + 1) as u32;
        let record = pensioner_to_csv_record(p);
        for (col_idx, value) in record.iter().enumerate() {
            let col = col_idx as u16;
            if currency_cols.contains(&col_idx) {
                if let Ok(num) = value.parse::<f64>() {
                    worksheet
                        .write_number_with_format(row, col, num, &currency_format)
                        .map_err(xlsx_err)?;
                } else {
                    worksheet
                        .write_string_with_format(row, col, value.as_str(), &currency_format)
                        .map_err(xlsx_err)?;
                }
            } else {
                worksheet
                    .write_string(row, col, value.as_str())
                    .map_err(xlsx_err)?;
            }
        }
    }

    workbook.save(path).map_err(|e| Error::Internal(format!("Excel save failed: {e}")))?;
    Ok(rows.len())
}

fn xlsx_err(e: XlsxError) -> Error {
    Error::Internal(format!("Excel error: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_formula_prefix() {
        assert_eq!(sanitize_cell("=SUM(A1)"), "'=SUM(A1)");
        assert_eq!(sanitize_cell("+123"), "'+123");
    }

    #[test]
    fn leaves_safe_text_unchanged() {
        assert_eq!(sanitize_cell("John Doe"), "John Doe");
    }
}
