use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

pub mod money;

pub use money::Money;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Admin,
    Verifier,
    Clerk,
}

impl std::fmt::Display for Role {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Role::Admin => write!(f, "admin"),
            Role::Verifier => write!(f, "verifier"),
            Role::Clerk => write!(f, "clerk"),
        }
    }
}

impl std::str::FromStr for Role {
    type Err = crate::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "admin" => Ok(Role::Admin),
            "verifier" => Ok(Role::Verifier),
            "clerk" => Ok(Role::Clerk),
            _ => Err(crate::Error::Validation(format!("Invalid role: {s}"))),
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: Role,
    pub full_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub is_active: bool,
    pub last_login: Option<DateTime<Utc>>,
    pub password_changed_at: Option<DateTime<Utc>>,
    pub must_change_password: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
#[serde(rename_all = "PascalCase")]
pub enum PensionerStatus {
    Unverified,
    Verified,
    Rejected,
}

impl std::fmt::Display for PensionerStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PensionerStatus::Unverified => write!(f, "Unverified"),
            PensionerStatus::Verified => write!(f, "Verified"),
            PensionerStatus::Rejected => write!(f, "Rejected"),
        }
    }
}

impl std::str::FromStr for PensionerStatus {
    type Err = crate::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Unverified" => Ok(PensionerStatus::Unverified),
            "Verified" => Ok(PensionerStatus::Verified),
            "Rejected" => Ok(PensionerStatus::Rejected),
            _ => Err(crate::Error::Validation(format!("Invalid status: {s}"))),
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Pensioner {
    pub id: Uuid,

    // Personal Information
    pub full_name: String,
    pub gender: Option<String>,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub location: Option<String>,
    pub zone: Option<String>,
    pub photo_path: Option<String>,

    // Employment & Service Records
    pub salary_structure: Option<String>,
    pub mda_name: Option<String>,
    pub grade: Option<String>,
    pub step: Option<String>,
    pub first_appointment_date: Option<chrono::NaiveDate>,
    pub last_promotion_date: Option<chrono::NaiveDate>,
    pub retirement_date: Option<chrono::NaiveDate>,
    pub years_of_service: Option<i32>,
    pub months_of_service: Option<i32>,

    // Financial & Payment Information
    pub apa: Money,
    pub gratuity: Money,
    pub pension: Money,
    pub repatriation: Money,
    pub total_employee_contribution_due: Money,
    pub amount_owed: Money,
    pub amount_owed_to_mda: Money,
    pub amount_paid_by_oagf: Money,

    // Auto-Calculated Fields
    pub ten_percent_gratuity: Money,
    pub ten_percent_pension: Money,
    pub due_for_payment_by_oagf: Money,

    // Banking Information
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub sort_code: Option<String>,
    pub bank_address: Option<String>,

    // Next of Kin & Verification
    pub nok_name: Option<String>,
    pub nok_phone: Option<String>,
    pub nok_relation: Option<String>,
    pub nok_payment: bool,

    // Workflow & Metadata
    pub status: PensionerStatus,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub verification_notes: Option<String>,

    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub user_name: Option<String>,
    pub action: String,
    pub table_name: Option<String>,
    pub record_id: Option<Uuid>,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub session_id: Option<Uuid>,
    pub performed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub last_active_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginCredentials {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserRequest {
    pub full_name: String,
    pub username: String,
    pub role: Role,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateUserRequest {
    pub full_name: Option<String>,
    pub role: Option<Role>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ListFilter {
    pub status: Option<PensionerStatus>,
    pub search: Option<String>,
    pub mda: Option<String>,
    pub zone: Option<String>,
    pub date_from: Option<chrono::NaiveDate>,
    pub date_to: Option<chrono::NaiveDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_pensioners: i64,
    pub unverified_count: i64,
    pub verified_count: i64,
    pub rejected_count: i64,
    pub total_liability: Money,
    pub total_paid: Money,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportFilter {
    pub scope: String,
    pub date_from: Option<chrono::NaiveDate>,
    pub date_to: Option<chrono::NaiveDate>,
    pub mda: Option<String>,
    pub zone: Option<String>,
}
