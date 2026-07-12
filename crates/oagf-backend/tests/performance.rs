//! Performance baseline tests.
//!
//! Run with:
//!   DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend --test performance -- --nocapture

use std::time::Instant;
use uuid::Uuid;

use oagf_backend::auth;
use oagf_backend::commands;
use oagf_backend::models::{ListFilter, LoginCredentials, Money};

fn test_db_url() -> String {
    std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/oagf_pension_test".to_string())
}

async fn setup_pool() -> sqlx::PgPool {
    use sqlx::postgres::PgPoolOptions;
    std::env::set_var("DATABASE_URL", test_db_url());
    let options: sqlx::postgres::PgConnectOptions = test_db_url().parse().unwrap();
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect_with(options)
        .await
        .expect("failed to connect to test database");
    sqlx::migrate!("../oagf-backend/migrations")
        .run(&pool)
        .await
        .expect("migrations failed");
    pool
}

async fn seed_admin(pool: &sqlx::PgPool) -> (String, String) {
    let password = "PerfAdmin@123";
    let hash = auth::hash_password(password).unwrap();
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, 'perfadmin', $2, 'admin', 'Perf Admin', TRUE, FALSE, NOW(), NOW())
         ON CONFLICT (username) DO UPDATE SET
             password_hash = EXCLUDED.password_hash,
             is_active = TRUE,
             must_change_password = FALSE"
    )
    .bind(id)
    .bind(hash)
    .execute(pool)
    .await
    .unwrap();
    ("perfadmin".to_string(), password.to_string())
}

async fn seed_pensioners(pool: &sqlx::PgPool, count: usize) {
    let mut tx = pool.begin().await.unwrap();
    for i in 0..count {
        let id = Uuid::new_v4();
        let name = format!("Pensioner {}", i);
        let mda = if i % 2 == 0 { "Finance" } else { "Health" };
        sqlx::query(
            "INSERT INTO pensioners (
                id, full_name, status, mda_name, location, zone,
                amount_owed, amount_paid_by_oagf, gratuity, pension,
                created_by, updated_by, created_at, updated_at
            ) VALUES ($1, $2, 'Unverified', $3, 'Abuja', 'North-Central',
                     1000000.00, 0.00, 500000.00, 300000.00,
                     NULL, NULL, NOW() - ($4 || ' seconds')::interval, NOW() - ($4 || ' seconds')::interval)"
        )
        .bind(id)
        .bind(name)
        .bind(mda)
        .bind(i as i64)
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    tx.commit().await.unwrap();
}

fn percentile(sorted_ms: &[f64], p: f64) -> f64 {
    let idx = ((sorted_ms.len() - 1) as f64 * p).round() as usize;
    sorted_ms[idx.min(sorted_ms.len() - 1)]
}

fn report(name: &str, times: &mut [f64]) {
    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!(
        "{name}: count={} p50={:.2}ms p95={:.2}ms p99={:.2}ms max={:.2}ms",
        times.len(),
        percentile(times, 0.50),
        percentile(times, 0.95),
        percentile(times, 0.99),
        times.last().unwrap_or(&0.0)
    );
}

#[tokio::test]
async fn baseline_latency() {
    let pool = setup_pool().await;

    println!("Seeding 1,000 pensioners...");
    {
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
    }

    let (admin_user, admin_pass) = seed_admin(&pool).await;
    seed_pensioners(&pool, 1000).await;
    println!("Done seeding.");

    // Warm up.
    let _ = auth::authenticate(
        &pool,
        LoginCredentials {
            username: admin_user.clone(),
            password: admin_pass.clone(),
        },
    )
    .await
    .unwrap();

    // Login latency (Argon2 is intentionally slow; 10 samples is enough).
    let mut login_times = Vec::new();
    for _ in 0..10 {
        let start = Instant::now();
        let _ = auth::authenticate(
            &pool,
            LoginCredentials {
                username: admin_user.clone(),
                password: admin_pass.clone(),
            },
        )
        .await
        .unwrap();
        login_times.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    report("login", &mut login_times);

    // List pensioners latency (no search).
    let mut list_times = Vec::new();
    let default_filter = ListFilter::default();
    for _ in 0..100 {
        let start = Instant::now();
        let mut query = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM pensioners WHERE 1=1");
        commands::pensioners::push_pensioner_filters(&mut query, &default_filter);
        let total: i64 = query.build_query_scalar().fetch_one(&pool).await.unwrap();

        let mut query = sqlx::QueryBuilder::new("SELECT * FROM pensioners WHERE 1=1");
        commands::pensioners::push_pensioner_filters(&mut query, &default_filter);
        query.push(" ORDER BY created_at DESC LIMIT ");
        query.push_bind(20i64);
        query.push(" OFFSET ");
        query.push_bind(0i64);
        let rows: Vec<oagf_backend::models::Pensioner> = query.build_query_as().fetch_all(&pool).await.unwrap();
        assert_eq!(rows.len(), 20);
        assert_eq!(total, 1000);
        list_times.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    report("list_pensioners_page_1", &mut list_times);

    // Search latency.
    let mut search_times = Vec::new();
    for _ in 0..100 {
        let start = Instant::now();
        let filter = ListFilter {
            search: Some("Pensioner 5".to_string()),
            ..Default::default()
        };
        let mut count_query = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM pensioners WHERE 1=1");
        commands::pensioners::push_pensioner_filters(&mut count_query, &filter);
        let _total: i64 = count_query.build_query_scalar().fetch_one(&pool).await.unwrap();

        let mut data_query = sqlx::QueryBuilder::new("SELECT * FROM pensioners WHERE 1=1");
        commands::pensioners::push_pensioner_filters(&mut data_query, &filter);
        data_query.push(" ORDER BY created_at DESC LIMIT ");
        data_query.push_bind(20i64);
        data_query.push(" OFFSET ");
        data_query.push_bind(0i64);
        let _rows: Vec<oagf_backend::models::Pensioner> = data_query.build_query_as().fetch_all(&pool).await.unwrap();
        search_times.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    report("search_pensioners", &mut search_times);

    // Dashboard stats latency.
    let mut dashboard_times = Vec::new();
    for _ in 0..100 {
        let start = Instant::now();
        let _: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners").fetch_one(&pool).await.unwrap();
        let _: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners WHERE status = 'Unverified'").fetch_one(&pool).await.unwrap();
        let _: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners WHERE status = 'Verified'").fetch_one(&pool).await.unwrap();
        let _: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pensioners WHERE status = 'Rejected'").fetch_one(&pool).await.unwrap();
        let _: Money = sqlx::query_scalar("SELECT COALESCE(SUM(due_for_payment_by_oagf), 0) FROM pensioners").fetch_one(&pool).await.unwrap();
        let _: Money = sqlx::query_scalar("SELECT COALESCE(SUM(amount_paid_by_oagf), 0) FROM pensioners").fetch_one(&pool).await.unwrap();
        dashboard_times.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    report("dashboard_stats", &mut dashboard_times);
}
