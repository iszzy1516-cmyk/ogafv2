//! Concurrency and load tests.
//!
//! Run with:
//!   DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend --test concurrency -- --nocapture

use std::time::Instant;
use tokio::sync::Mutex;
use tokio::task::JoinSet;
use uuid::Uuid;

use oagf_backend::auth;
use oagf_backend::models::{ListFilter, LoginCredentials};

static TEST_MUTEX: Mutex<()> = Mutex::const_new(());

fn test_db_url() -> String {
    std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/oagf_pension_test".to_string())
}

async fn setup_pool() -> sqlx::PgPool {
    use sqlx::postgres::PgPoolOptions;
    std::env::set_var("DATABASE_URL", test_db_url());
    let options: sqlx::postgres::PgConnectOptions = test_db_url().parse().unwrap();
    let pool = PgPoolOptions::new()
        .max_connections(20)
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

async fn seed_admin(pool: &sqlx::PgPool) -> (String, String) {
    let password = "Admin@123";
    let hash = auth::hash_password(password).unwrap();
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, 'concurrency_admin', $2, 'admin', 'Concurrency Admin', TRUE, FALSE, NOW(), NOW())"
    )
    .bind(id)
    .bind(hash)
    .execute(pool)
    .await
    .unwrap();
    ("concurrency_admin".to_string(), password.to_string())
}

#[tokio::test]
async fn concurrent_logins_succeed_for_same_user() {
    let _guard = TEST_MUTEX.lock().await;
    let pool = setup_pool().await;
    let (admin_user, admin_pass) = seed_admin(&pool).await;

    let start = Instant::now();
    let mut set = JoinSet::new();
    for _ in 0..20 {
        let pool = pool.clone();
        let user = admin_user.clone();
        let pass = admin_pass.clone();
        set.spawn(async move {
            auth::authenticate(
                &pool,
                LoginCredentials {
                    username: user,
                    password: pass,
                },
            )
            .await
        });
    }

    let mut ok = 0;
    while let Some(res) = set.join_next().await {
        if res.unwrap().is_ok() {
            ok += 1;
        }
    }

    println!(
        "concurrent_logins: {} succeeded in {:?}",
        ok,
        start.elapsed()
    );
    assert_eq!(ok, 20, "all concurrent logins should create independent sessions");
}

#[tokio::test]
async fn concurrent_pensioner_creates_persist_all_records() {
    let _guard = TEST_MUTEX.lock().await;
    let pool = setup_pool().await;
    let admin_id = Uuid::new_v4();
    let admin_hash = auth::hash_password("Admin@123").unwrap();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, 'create_admin', $2, 'admin', 'Create Admin', TRUE, FALSE, NOW(), NOW())"
    )
    .bind(admin_id)
    .bind(admin_hash)
    .execute(&pool)
    .await
    .unwrap();

    let start = Instant::now();
    let mut set = JoinSet::new();
    for i in 0..50 {
        let pool = pool.clone();
        set.spawn(async move {
            sqlx::query(
                "INSERT INTO pensioners (id, full_name, status, amount_owed, amount_paid_by_oagf, created_by, updated_by, created_at, updated_at)
                 VALUES ($1, $2, 'Unverified', 100000.00, 0.00, $3, $3, NOW(), NOW())"
            )
            .bind(Uuid::new_v4())
            .bind(format!("Concurrent Pensioner {}", i))
            .bind(admin_id)
            .execute(&pool)
            .await
        });
    }

    while let Some(res) = set.join_next().await {
        res.unwrap().unwrap();
    }

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 50, "all 50 concurrent inserts should persist");
    println!("concurrent_creates: {} records in {:?}", count, start.elapsed());
}

#[tokio::test]
async fn concurrent_verify_race_has_exactly_one_winner() {
    let _guard = TEST_MUTEX.lock().await;
    let pool = setup_pool().await;
    let admin_id = Uuid::new_v4();
    let admin_hash = auth::hash_password("Admin@123").unwrap();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, 'race_admin', $2, 'admin', 'Race Admin', TRUE, FALSE, NOW(), NOW())"
    )
    .bind(admin_id)
    .bind(admin_hash)
    .execute(&pool)
    .await
    .unwrap();

    let pensioner_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO pensioners (id, full_name, status, amount_owed, amount_paid_by_oagf, created_by, updated_by, created_at, updated_at)
         VALUES ($1, 'Race Pensioner', 'Unverified', 100000.00, 0.00, $2, $2, NOW(), NOW())"
    )
    .bind(pensioner_id)
    .bind(admin_id)
    .execute(&pool)
    .await
    .unwrap();

    let start = Instant::now();
    let mut set = JoinSet::new();
    for i in 0..10 {
        let pool = pool.clone();
        set.spawn(async move {
            sqlx::query_as::<_, oagf_backend::models::Pensioner>(
                "UPDATE pensioners SET status = 'Verified', verified_by = $1, verified_at = NOW(),
                 verification_notes = $2, updated_at = NOW()
                 WHERE id = $3 AND status = 'Unverified'
                 RETURNING *"
            )
            .bind(admin_id)
            .bind(format!("verifier-{}", i))
            .bind(pensioner_id)
            .fetch_optional(&pool)
            .await
        });
    }

    let mut winners = 0;
    while let Some(res) = set.join_next().await {
        if res.unwrap().unwrap().is_some() {
            winners += 1;
        }
    }

    println!(
        "concurrent_verify_race: {} winners in {:?}",
        winners,
        start.elapsed()
    );
    assert_eq!(winners, 1, "exactly one concurrent verify should win");
}

#[tokio::test]
async fn concurrent_list_queries_remain_consistent() {
    let _guard = TEST_MUTEX.lock().await;
    let pool = setup_pool().await;
    for i in 0..100 {
        sqlx::query(
            "INSERT INTO pensioners (id, full_name, status, amount_owed, amount_paid_by_oagf, created_by, updated_by, created_at, updated_at)
             VALUES ($1, $2, 'Unverified', 100000.00, 0.00, NULL, NULL, NOW(), NOW())"
        )
        .bind(Uuid::new_v4())
        .bind(format!("List Pensioner {}", i))
        .execute(&pool)
        .await
        .unwrap();
    }

    let mut set = JoinSet::new();
    for _ in 0..30 {
        let pool = pool.clone();
        set.spawn(async move {
            let filter = ListFilter::default();
            let mut query = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM pensioners WHERE 1=1");
            oagf_backend::commands::pensioners::push_pensioner_filters(&mut query, &filter);
            let count: i64 = query.build_query_scalar().fetch_one(&pool).await.unwrap();
            count
        });
    }

    while let Some(res) = set.join_next().await {
        assert_eq!(res.unwrap(), 100, "all concurrent list queries should see 100 records");
    }
}
