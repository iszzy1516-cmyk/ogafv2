//! Multi-window / multi-session behavior tests.
//!
//! Run with:
//!   DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend --test multi_window -- --nocapture

use tokio::sync::Mutex;
use uuid::Uuid;

use oagf_backend::auth;
use oagf_backend::models::LoginCredentials;

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

async fn seed_user(pool: &sqlx::PgPool, username: &str) -> String {
    let password = "WindowTest@123";
    let hash = auth::hash_password(password).unwrap();
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, $2, $3, 'admin', 'Window Test Admin', TRUE, FALSE, NOW(), NOW())"
    )
    .bind(id)
    .bind(username)
    .bind(hash)
    .execute(pool)
    .await
    .unwrap();
    password.to_string()
}

static TEST_MUTEX: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn multiple_logins_create_independent_sessions() {
    let _guard = TEST_MUTEX.lock().await;
    let pool = setup_pool().await;
    let password = seed_user(&pool, "multi_window_user").await;

    let token1 = auth::authenticate(
        &pool,
        LoginCredentials {
            username: "multi_window_user".to_string(),
            password: password.clone(),
        },
    )
    .await
    .unwrap()
    .0;

    let token2 = auth::authenticate(
        &pool,
        LoginCredentials {
            username: "multi_window_user".to_string(),
            password: password.clone(),
        },
    )
    .await
    .unwrap()
    .0;

    assert_ne!(token1, token2, "each login must produce a distinct session token");

    // Both tokens should be valid initially.
    assert!(auth::validate_session(&pool, &token1).await.is_ok());
    assert!(auth::validate_session(&pool, &token2).await.is_ok());

    // Logging out one window should not kill the other window's session.
    auth::invalidate_session(&pool, &token1).await.unwrap();
    assert!(auth::validate_session(&pool, &token1).await.is_err());
    assert!(auth::validate_session(&pool, &token2).await.is_ok(), "other window's session must remain valid");
}

#[tokio::test]
async fn session_expiry_is_enforced_globally() {
    let _guard = TEST_MUTEX.lock().await;
    let pool = setup_pool().await;
    let password = seed_user(&pool, "expiry_user").await;

    let (token, _) = auth::authenticate(
        &pool,
        LoginCredentials {
            username: "expiry_user".to_string(),
            password,
        },
    )
    .await
    .unwrap();

    assert!(auth::validate_session(&pool, &token).await.is_ok());

    // Manually expire the session to simulate time passing.
    sqlx::query("UPDATE sessions SET expires_at = NOW() - INTERVAL '1 minute'")
        .execute(&pool)
        .await
        .unwrap();

    // The same token must now be rejected in every window.
    assert!(auth::validate_session(&pool, &token).await.is_err());
}
