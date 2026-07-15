use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::audit::AuditEvent;
use crate::auth::{extract_user, require_role};
use crate::BackendState;
use crate::models::{ListFilter, Money, PaginationParams, Pensioner, Role};
use crate::Error;

#[derive(Debug, Default, serde::Deserialize)]
pub struct CreatePensionerRequest {
    pub full_name: Option<String>,
    pub gender: Option<String>,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub location: Option<String>,
    pub zone: Option<String>,
    pub phone: Option<String>,
    pub photo_path: Option<String>,
    pub salary_structure: Option<String>,
    pub mda_name: Option<String>,
    pub grade: Option<String>,
    pub step: Option<String>,
    pub first_appointment_date: Option<chrono::NaiveDate>,
    pub last_promotion_date: Option<chrono::NaiveDate>,
    pub retirement_date: Option<chrono::NaiveDate>,
    pub years_of_service: Option<i32>,
    pub months_of_service: Option<i32>,
    pub apa: Option<Money>,
    pub gratuity: Option<Money>,
    pub pension: Option<Money>,
    pub repatriation: Option<Money>,
    pub total_employee_contribution_due: Option<Money>,
    pub amount_owed: Option<Money>,
    pub amount_owed_to_mda: Option<Money>,
    pub amount_paid_by_oagf: Option<Money>,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub sort_code: Option<String>,
    pub bank_address: Option<String>,
    pub nok_name: Option<String>,
    pub nok_phone: Option<String>,
    pub nok_relation: Option<String>,
    pub nok_payment: Option<bool>,
}

const MAX_FIELD_LEN: usize = 255;

fn validate_length(value: &Option<String>, name: &str) -> Result<(), Error> {
    if let Some(v) = value {
        if v.len() > MAX_FIELD_LEN {
            return Err(Error::Validation(format!("{} exceeds {} characters", name, MAX_FIELD_LEN)));
        }
    }
    Ok(())
}

fn validate_pensioner(req: &CreatePensionerRequest) -> Result<(), Error> {
    let full_name = req.full_name.as_deref().unwrap_or("").trim();
    if full_name.is_empty() {
        return Err(Error::Validation("Full name is required".into()));
    }
    if full_name.len() > MAX_FIELD_LEN {
        return Err(Error::Validation(format!("Full name exceeds {} characters", MAX_FIELD_LEN)));
    }
    if let Some(ref acct) = req.account_number {
        if acct.len() != 10 || !acct.chars().all(|c| c.is_ascii_digit()) {
            return Err(Error::Validation("Account number must be 10 digits".into()));
        }
    }
    if let Some(y) = req.years_of_service {
        if y < 0 || y > 100 {
            return Err(Error::Validation("Years of service must be between 0 and 100".into()));
        }
    }
    if let Some(m) = req.months_of_service {
        if m < 0 || m > 11 {
            return Err(Error::Validation("Months of service must be between 0 and 11".into()));
        }
    }
    validate_length(&req.location, "Location")?;
    validate_length(&req.zone, "Zone")?;
    validate_length(&req.phone, "Phone")?;
    validate_length(&req.mda_name, "MDA name")?;
    validate_length(&req.bank_name, "Bank name")?;
    validate_length(&req.nok_name, "Next of kin name")?;
    validate_length(&req.nok_relation, "Next of kin relation")?;
    Ok(())
}

fn calc_amount_owed(req: &CreatePensionerRequest) -> Money {
    req.amount_owed.unwrap_or(Money::zero())
}

fn ten_percent(value: Money) -> Money {
    use rust_decimal::Decimal;
    use std::str::FromStr;
    Money((value.0 * Decimal::from_str("0.1").unwrap()).round_dp(2))
}

fn calc_due_for_payment(req: &CreatePensionerRequest) -> Money {
    let gratuity = req.gratuity.unwrap_or(Money::zero());
    let pension = req.pension.unwrap_or(Money::zero());
    let repatriation = req.repatriation.unwrap_or(Money::zero());
    let employee_contribution = req.total_employee_contribution_due.unwrap_or(Money::zero());
    let amount_owed = calc_amount_owed(req);
    let paid = req.amount_paid_by_oagf.unwrap_or(Money::zero());

    let ten_percent_gratuity = ten_percent(gratuity);
    let ten_percent_pension = ten_percent(pension);

    gratuity + ten_percent_gratuity + pension + ten_percent_pension + repatriation + employee_contribution
        - amount_owed
        - paid
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_pensioner(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    data: CreatePensionerRequest,
) -> Result<Pensioner, Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin, Role::Clerk])?;
    validate_pensioner(&data)?;
    let db = backend.db().await?;

    let zero = Money::zero();
    let amount_owed = calc_amount_owed(&data);
    let ten_percent_gratuity = ten_percent(data.gratuity.unwrap_or(zero));
    let ten_percent_pension = ten_percent(data.pension.unwrap_or(zero));
    let due_for_payment_by_oagf = calc_due_for_payment(&data);
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    sqlx::query(
        "INSERT INTO pensioners (
            id, full_name, gender, date_of_birth, location, zone, phone, photo_path,
            salary_structure, mda_name, grade, step, first_appointment_date, last_promotion_date, retirement_date,
            years_of_service, months_of_service,
            apa, gratuity, pension, repatriation, total_employee_contribution_due,
            amount_owed, amount_owed_to_mda, amount_paid_by_oagf,
            ten_percent_gratuity, ten_percent_pension, due_for_payment_by_oagf,
            bank_name, account_number, sort_code, bank_address,
            nok_name, nok_phone, nok_relation, nok_payment,
            status, created_by, updated_by, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15,
            $16, $17,
            $18, $19, $20, $21, $22,
            $23, $24, $25,
            $26, $27, $28,
            $29, $30, $31, $32,
            $33, $34, $35, $36,
            'Unverified', $37, $37, $38, $38
        )"
    )
    .bind(id)
    .bind(data.full_name.as_ref().unwrap())
    .bind(&data.gender)
    .bind(data.date_of_birth)
    .bind(&data.location)
    .bind(&data.zone)
    .bind(&data.phone)
    .bind(&data.photo_path)
    .bind(&data.salary_structure)
    .bind(&data.mda_name)
    .bind(&data.grade)
    .bind(&data.step)
    .bind(data.first_appointment_date)
    .bind(data.last_promotion_date)
    .bind(data.retirement_date)
    .bind(data.years_of_service)
    .bind(data.months_of_service)
    .bind(data.apa.unwrap_or(zero))
    .bind(data.gratuity.unwrap_or(zero))
    .bind(data.pension.unwrap_or(zero))
    .bind(data.repatriation.unwrap_or(zero))
    .bind(data.total_employee_contribution_due.unwrap_or(zero))
    .bind(amount_owed)
    .bind(data.amount_owed_to_mda.unwrap_or(zero))
    .bind(data.amount_paid_by_oagf.unwrap_or(zero))
    .bind(ten_percent_gratuity)
    .bind(ten_percent_pension)
    .bind(due_for_payment_by_oagf)
    .bind(&data.bank_name)
    .bind(&data.account_number)
    .bind(&data.sort_code)
    .bind(&data.bank_address)
    .bind(&data.nok_name)
    .bind(&data.nok_phone)
    .bind(&data.nok_relation)
    .bind(data.nok_payment.unwrap_or(false))
    .bind(user.id)
    .bind(now)
    .execute(db.pool())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let pensioner = get_pensioner_by_id(db.pool(), id).await?;

    crate::audit::log_event(
        db.pool(),
        AuditEvent {
            user_id: user.id,
            user_name: user.full_name.clone(),
            action: "CREATE".into(),
            table_name: Some("pensioners".into()),
            record_id: Some(pensioner.id),
            old_values: None,
            new_values: Some(serde_json::to_value(&pensioner).unwrap_or_default()),
        },
    )
    .await?;

    Ok(pensioner)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_pensioner(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    id: Uuid,
) -> Result<Pensioner, Error> {
    let _user = extract_user(&backend, &token).await?;
    let db = backend.db().await?;
    get_pensioner_by_id(db.pool(), id).await
}

async fn get_pensioner_by_id(pool: &sqlx::PgPool, id: Uuid) -> Result<Pensioner, Error> {
    sqlx::query_as::<_, Pensioner>("SELECT * FROM pensioners WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or(Error::NotFound)
}

/// Builds a LIKE search pattern with wildcards and escapes `%`, `_`, and `\`.
#[doc(hidden)]
pub fn like_pattern(input: &str) -> String {
    let escaped = input.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    format!("%{}%", escaped)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn list_pensioners(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    filter: ListFilter,
    pagination: PaginationParams,
) -> Result<crate::models::PaginatedResponse<Pensioner>, Error> {
    let _user = extract_user(&backend, &token).await?;
    let db = backend.db().await?;

    let page = pagination.page.max(1);
    let per_page = pagination.per_page.max(1).min(100);
    let offset = (page - 1) * per_page;

    // Count query: fully parameterized, no string concatenation of user input.
    let mut count_query = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM pensioners WHERE 1=1");
    push_pensioner_filters(&mut count_query, &filter);
    let total: i64 = count_query
        .build_query_scalar()
        .fetch_one(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    // Data query: parameterized filters + bound LIMIT/OFFSET.
    let mut data_query = sqlx::QueryBuilder::new("SELECT * FROM pensioners WHERE 1=1");
    push_pensioner_filters(&mut data_query, &filter);
    data_query.push(" ORDER BY created_at DESC LIMIT ");
    data_query.push_bind(per_page);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let data: Vec<Pensioner> = data_query
        .build_query_as()
        .fetch_all(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(crate::models::PaginatedResponse {
        data,
        total,
        page,
        per_page,
        total_pages: total_pages.max(1),
    })
}

/// Appends parameterized WHERE conditions for pensioner filters.
/// All user-supplied values are bound as parameters to prevent SQL injection.
#[doc(hidden)]
pub fn push_pensioner_filters<'a>(
    query: &mut sqlx::QueryBuilder<'a, sqlx::Postgres>,
    filter: &'a ListFilter,
) {
    if let Some(status) = &filter.status {
        query.push(" AND status = ");
        query.push_bind(status.to_string());
    }
    if let Some(search) = &filter.search {
        let pattern = like_pattern(search);
        query.push(" AND (full_name ILIKE ");
        query.push_bind(pattern.clone());
        query.push(" ESCAPE '\\' OR mda_name ILIKE ");
        query.push_bind(pattern.clone());
        query.push(" ESCAPE '\\' OR location ILIKE ");
        query.push_bind(pattern);
        query.push(" ESCAPE '\\')");
    }
    if let Some(mda) = &filter.mda {
        query.push(" AND mda_name ILIKE ");
        query.push_bind(like_pattern(mda));
        query.push(" ESCAPE '\\'");
    }
    if let Some(zone) = &filter.zone {
        query.push(" AND zone = ");
        query.push_bind(zone);
    }
    if let Some(date_from) = filter.date_from {
        query.push(" AND created_at >= ");
        query.push_bind(date_from);
    }
    if let Some(date_to) = filter.date_to {
        query.push(" AND created_at <= ");
        query.push_bind(date_to);
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn update_pensioner(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    id: Uuid,
    data: CreatePensionerRequest,
) -> Result<Pensioner, Error> {
    let user = extract_user(&backend, &token).await?;
    let existing = get_pensioner(backend.clone(), token.clone(), id).await?;

    if user.role != Role::Admin && !(user.role == Role::Clerk && existing.created_by == Some(user.id)) {
        return Err(Error::Forbidden);
    }
    validate_pensioner(&data)?;
    let db = backend.db().await?;

    let old_values = serde_json::to_value(&existing).unwrap_or_default();
    let zero = Money::zero();
    let amount_owed = calc_amount_owed(&data);
    let ten_percent_gratuity = ten_percent(data.gratuity.unwrap_or(zero));
    let ten_percent_pension = ten_percent(data.pension.unwrap_or(zero));
    let due_for_payment_by_oagf = calc_due_for_payment(&data);
    let now = chrono::Utc::now();

    let updated_name = data.full_name.as_ref().unwrap_or(&existing.full_name).clone();

    sqlx::query(
        "UPDATE pensioners SET
            full_name = $1, gender = $2, date_of_birth = $3, location = $4, zone = $5, phone = $6, photo_path = $7,
            salary_structure = $8, mda_name = $9, grade = $10, step = $11,
            first_appointment_date = $12, last_promotion_date = $13, retirement_date = $14,
            years_of_service = $15, months_of_service = $16,
            apa = $17, gratuity = $18, pension = $19, repatriation = $20,
            total_employee_contribution_due = $21, amount_owed = $22, amount_owed_to_mda = $23, amount_paid_by_oagf = $24,
            ten_percent_gratuity = $25, ten_percent_pension = $26, due_for_payment_by_oagf = $27,
            bank_name = $28, account_number = $29, sort_code = $30, bank_address = $31,
            nok_name = $32, nok_phone = $33, nok_relation = $34, nok_payment = $35,
            updated_by = $36, updated_at = $37
        WHERE id = $38"
    )
    .bind(&updated_name)
    .bind(&data.gender)
    .bind(data.date_of_birth)
    .bind(&data.location)
    .bind(&data.zone)
    .bind(&data.phone)
    .bind(&data.photo_path)
    .bind(&data.salary_structure)
    .bind(&data.mda_name)
    .bind(&data.grade)
    .bind(&data.step)
    .bind(data.first_appointment_date)
    .bind(data.last_promotion_date)
    .bind(data.retirement_date)
    .bind(data.years_of_service)
    .bind(data.months_of_service)
    .bind(data.apa.unwrap_or(zero))
    .bind(data.gratuity.unwrap_or(zero))
    .bind(data.pension.unwrap_or(zero))
    .bind(data.repatriation.unwrap_or(zero))
    .bind(data.total_employee_contribution_due.unwrap_or(zero))
    .bind(amount_owed)
    .bind(data.amount_owed_to_mda.unwrap_or(zero))
    .bind(data.amount_paid_by_oagf.unwrap_or(zero))
    .bind(ten_percent_gratuity)
    .bind(ten_percent_pension)
    .bind(due_for_payment_by_oagf)
    .bind(&data.bank_name)
    .bind(&data.account_number)
    .bind(&data.sort_code)
    .bind(&data.bank_address)
    .bind(&data.nok_name)
    .bind(&data.nok_phone)
    .bind(&data.nok_relation)
    .bind(data.nok_payment.unwrap_or(false))
    .bind(user.id)
    .bind(now)
    .bind(id)
    .execute(db.pool())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let updated = get_pensioner_by_id(db.pool(), id).await?;

    crate::audit::log_event(
        db.pool(),
        AuditEvent {
            user_id: user.id,
            user_name: user.full_name,
            action: "UPDATE".into(),
            table_name: Some("pensioners".into()),
            record_id: Some(id),
            old_values: Some(old_values),
            new_values: Some(serde_json::to_value(&updated).unwrap_or_default()),
        },
    )
    .await?;

    Ok(updated)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn verify_pensioner(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    id: Uuid,
    notes: Option<String>,
) -> Result<Pensioner, Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin, Role::Clerk, Role::Verifier])?;
    let db = backend.db().await?;

    let now = chrono::Utc::now();

    // Atomic update: only verify records that are currently Unverified.
    // This prevents two concurrent verifiers from both succeeding.
    let updated: Pensioner = sqlx::query_as(
        "UPDATE pensioners SET status = 'Verified', verified_by = $1, verified_at = $2,
         verification_notes = $3, updated_at = $2
         WHERE id = $4 AND status = 'Unverified'
         RETURNING *"
    )
    .bind(user.id)
    .bind(now)
    .bind(&notes)
    .bind(id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::Validation("Record is already verified/rejected or does not exist".into()))?;

    crate::audit::log_event(
        db.pool(),
        AuditEvent {
            user_id: user.id,
            user_name: user.full_name,
            action: "VERIFY".into(),
            table_name: Some("pensioners".into()),
            record_id: Some(id),
            old_values: Some(serde_json::json!({ "status": "Unverified" })),
            new_values: Some(serde_json::json!({ "status": "Verified", "verification_notes": notes })),
        },
    )
    .await?;

    Ok(updated)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn reject_pensioner(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    id: Uuid,
    notes: Option<String>,
) -> Result<Pensioner, Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin, Role::Clerk, Role::Verifier])?;
    let db = backend.db().await?;

    let now = chrono::Utc::now();

    let updated: Pensioner = sqlx::query_as(
        "UPDATE pensioners SET status = 'Rejected', verified_by = $1, verified_at = $2,
         verification_notes = $3, updated_at = $2
         WHERE id = $4 AND status = 'Unverified'
         RETURNING *"
    )
    .bind(user.id)
    .bind(now)
    .bind(&notes)
    .bind(id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::Validation("Record is already verified/rejected or does not exist".into()))?;

    crate::audit::log_event(
        db.pool(),
        AuditEvent {
            user_id: user.id,
            user_name: user.full_name,
            action: "REJECT".into(),
            table_name: Some("pensioners".into()),
            record_id: Some(id),
            old_values: Some(serde_json::json!({ "status": "Unverified" })),
            new_values: Some(serde_json::json!({ "status": "Rejected", "verification_notes": notes })),
        },
    )
    .await?;

    Ok(updated)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_pensioner(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    id: Uuid,
) -> Result<(), Error> {
    let user = extract_user(&backend, &token).await?;
    require_role(&user, &[Role::Admin])?;
    let db = backend.db().await?;

    let existing = get_pensioner(backend.clone(), token, id).await?;
    let old_values = serde_json::to_value(&existing).unwrap_or_default();

    sqlx::query("DELETE FROM pensioners WHERE id = $1")
        .bind(id)
        .execute(db.pool())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod calculation_tests {
    use super::*;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    fn money(value: &str) -> Money {
        Money(Decimal::from_str(value).unwrap())
    }

    #[test]
    fn due_for_payment_matches_client_formula() {
        let req = CreatePensionerRequest {
            gratuity: Some(money("2500000.00")),
            pension: Some(money("1800000.00")),
            repatriation: Some(money("500000.00")),
            total_employee_contribution_due: Some(money("300000.00")),
            amount_owed: Some(money("0.00")),
            amount_paid_by_oagf: Some(money("0.00")),
            ..Default::default()
        };
        let due = calc_due_for_payment(&req);
        assert_eq!(due.0, money("5530000.00").0);
    }

    #[test]
    fn due_for_payment_with_owed_and_paid() {
        let req = CreatePensionerRequest {
            gratuity: Some(money("1000000.00")),
            pension: Some(money("500000.00")),
            repatriation: Some(money("100000.00")),
            total_employee_contribution_due: Some(money("50000.00")),
            amount_owed: Some(money("100000.00")),
            amount_paid_by_oagf: Some(money("50000.00")),
            ..Default::default()
        };
        let due = calc_due_for_payment(&req);
        // 1,000,000 + 100,000 + 500,000 + 50,000 + 100,000 + 50,000 - 100,000 - 50,000 = 1,650,000
        assert_eq!(due.0, money("1650000.00").0);
    }

    #[test]
    fn due_for_payment_with_zero_inputs() {
        let req = CreatePensionerRequest {
            ..Default::default()
        };
        let due = calc_due_for_payment(&req);
        assert_eq!(due.0, money("0.00").0);
    }

    #[test]
    fn ten_percent_rounds_to_two_decimals() {
        let value = money("1234567.89");
        let ten = ten_percent(value);
        assert_eq!(ten.0, money("123456.79").0);
    }
}
