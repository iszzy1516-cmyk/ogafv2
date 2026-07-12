//! Security and concurrency regression tests.
//!
//! These tests require a local PostgreSQL instance and use the database
//! `oagf_pension_test`. Run with:
//!
//!   DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend --test security

use uuid::Uuid;

use oagf_backend::auth;
use oagf_backend::commands;
use oagf_backend::models::{ListFilter, LoginCredentials, Role};

fn test_db_url() -> String {
    std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/oagf_pension_test".to_string())
}

async fn setup_pool() -> sqlx::PgPool {
    use sqlx::postgres::PgPoolOptions;
    std::env::set_var("DATABASE_URL", test_db_url());
    let options: sqlx::postgres::PgConnectOptions = test_db_url().parse().unwrap();
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .expect("failed to connect to test database");
    sqlx::migrate!("../oagf-backend/migrations")
        .run(&pool)
        .await
        .expect("migrations failed");

    // Serialize truncate across all parallel test binaries to avoid deadlocks.
    let mut conn = pool.acquire().await.expect("failed to acquire connection");
    sqlx::query("SELECT pg_advisory_lock(15161998)")
        .execute(&mut *conn)
        .await
        .expect("advisory lock failed");
    sqlx::query("TRUNCATE users, pensioners, sessions, audit_logs, login_attempts CASCADE")
        .execute(&mut *conn)
        .await
        .expect("truncate failed");
    sqlx::query("SELECT pg_advisory_unlock(15161998)")
        .execute(&mut *conn)
        .await
        .expect("advisory unlock failed");
    drop(conn);

    pool
}

async fn create_admin(pool: &sqlx::PgPool) -> (String, String) {
    let password = "Admin@123";
    let hash = auth::hash_password(password).unwrap();
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, 'testadmin', $2, 'admin', 'Test Admin', TRUE, FALSE, NOW(), NOW())"
    )
    .bind(id)
    .bind(hash)
    .execute(pool)
    .await
    .unwrap();
    ("testadmin".to_string(), password.to_string())
}

async fn create_test_pensioner(pool: &sqlx::PgPool, full_name: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO pensioners (
            id, full_name, status, amount_owed, amount_paid_by_oagf,
            created_by, updated_by, created_at, updated_at
        ) VALUES ($1, $2, 'Unverified', 100000.00, 0.00, NULL, NULL, NOW(), NOW())"
    )
    .bind(id)
    .bind(full_name)
    .execute(pool)
    .await
    .unwrap();
    id
}

#[tokio::test]
async fn sql_injection_in_pensioner_search_is_neutralized() {
    let pool = setup_pool().await;
    create_test_pensioner(&pool, "Alice Okonkwo").await;

    let mut query = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM pensioners WHERE 1=1");
    let filter = ListFilter {
        search: Some("' OR '1'='1".to_string()),
        ..Default::default()
    };
    commands::pensioners::push_pensioner_filters(&mut query, &filter);
    let count: i64 = query
        .build_query_scalar()
        .fetch_one(&pool)
        .await
        .expect("injection payload should not break the query");

    assert_eq!(
        count, 0,
        "injection payload should be treated as a literal search string, returning no rows"
    );
}

#[tokio::test]
async fn sql_injection_in_audit_action_filter_is_neutralized() {
    let pool = setup_pool().await;

    let mut query = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM audit_logs WHERE 1=1");
    let filter = commands::audit::AuditFilter {
        action: Some("' OR '1'='1".to_string()),
        user_id: None,
        date_from: None,
        date_to: None,
    };
    commands::audit::push_audit_filters(&mut query, &filter);
    let count: i64 = query
        .build_query_scalar()
        .fetch_one(&pool)
        .await
        .expect("injection payload should not break the query");

    assert_eq!(count, 0, "injection payload should not match any action");
}

#[tokio::test]
async fn repeated_failed_logins_lock_account() {
    let pool = setup_pool().await;
    let (admin_user, admin_pass) = create_admin(&pool).await;

    // Fail 5 times with the wrong password.
    for _ in 0..5 {
        let res = auth::authenticate(
            &pool,
            LoginCredentials {
                username: admin_user.clone(),
                password: "wrong-password".to_string(),
            },
        )
        .await;
        assert!(res.is_err(), "wrong password should fail");
    }

    // Even the correct password should now be rejected because the account is locked.
    let res = auth::authenticate(
        &pool,
        LoginCredentials {
            username: admin_user.clone(),
            password: admin_pass.clone(),
        },
    )
    .await;
    assert!(res.is_err(), "correct password should be rejected while account is locked");
}

#[tokio::test]
async fn verify_pensioner_is_atomic_against_double_verify() {
    let pool = setup_pool().await;
    let admin_id = Uuid::new_v4();
    let admin_hash = auth::hash_password("Admin@123").unwrap();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, 'atomicadmin', $2, 'admin', 'Atomic Admin', TRUE, FALSE, NOW(), NOW())"
    )
    .bind(admin_id)
    .bind(admin_hash)
    .execute(&pool)
    .await
    .unwrap();

    let pensioner_id = create_test_pensioner(&pool, "Bob Chukwu").await;

    // First verify succeeds.
    let first: Option<oagf_backend::models::Pensioner> = sqlx::query_as(
        "UPDATE pensioners SET status = 'Verified', verified_by = $1, verified_at = NOW(),
         verification_notes = $2, updated_at = NOW()
         WHERE id = $3 AND status = 'Unverified'
         RETURNING *"
    )
    .bind(admin_id)
    .bind("first")
    .bind(pensioner_id)
    .fetch_optional(&pool)
    .await
    .unwrap();
    assert!(first.is_some(), "first verify should succeed");

    // Second verify on the same record must return no row because it is no longer Unverified.
    let second: Option<oagf_backend::models::Pensioner> = sqlx::query_as(
        "UPDATE pensioners SET status = 'Verified', verified_by = $1, verified_at = NOW(),
         verification_notes = $2, updated_at = NOW()
         WHERE id = $3 AND status = 'Unverified'
         RETURNING *"
    )
    .bind(admin_id)
    .bind("second")
    .bind(pensioner_id)
    .fetch_optional(&pool)
    .await
    .unwrap();
    assert!(second.is_none(), "double verify should be rejected atomically");
}

#[tokio::test]
async fn role_check_rejects_clerk_on_admin_endpoints() {
    // Role is enforced by the command functions; this test documents the
    // requirement that a clerk token must be rejected by require_role.
    let clerk = oagf_backend::models::User {
        id: Uuid::new_v4(),
        username: "clerk".into(),
        password_hash: "hidden".into(),
        role: Role::Clerk,
        full_name: "Test Clerk".into(),
        email: None,
        phone: None,
        is_active: true,
        last_login: None,
        password_changed_at: None,
        must_change_password: false,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let res = oagf_backend::auth::require_role(&clerk, &[Role::Admin]);
    assert!(res.is_err(), "clerk must not pass admin role check");
}
