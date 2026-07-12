use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use rand::seq::SliceRandom;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{LoginCredentials, Role, Session, UpdateUserRequest, User};
use crate::Error;

const SESSION_DURATION_MINUTES: i64 = 15;
const MAX_FAILED_LOGIN_ATTEMPTS: i32 = 5;
const LOCKOUT_DURATION_MINUTES: i64 = 15;

fn session_duration() -> Duration {
    Duration::minutes(SESSION_DURATION_MINUTES)
}

/// Checks whether the username is currently locked out due to failed attempts.
/// Returns `Error::Unauthorized` when locked so the caller surface stays generic.
pub async fn check_login_lockout(pool: &PgPool, username: &str) -> Result<(), Error> {
    let now = Utc::now();
    let locked: Option<bool> = sqlx::query_scalar(
        "SELECT locked_until > $1 FROM login_attempts WHERE username = $2"
    )
    .bind(now)
    .bind(username)
    .fetch_optional(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    if locked.unwrap_or(false) {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

/// Records a failed login attempt. After `MAX_FAILED_LOGIN_ATTEMPTS` the account
/// is locked for `LOCKOUT_DURATION_MINUTES`.
pub async fn record_failed_login(pool: &PgPool, username: &str) -> Result<(), Error> {
    let now = Utc::now();
    let lockout_until = now + Duration::minutes(LOCKOUT_DURATION_MINUTES);

    sqlx::query(
        "INSERT INTO login_attempts (username, failed_count, locked_until, last_attempt_at)
         VALUES ($1, 1, CASE WHEN 1 >= $3 THEN $4 ELSE NULL END, $2)
         ON CONFLICT (username) DO UPDATE SET
             failed_count = CASE
                 WHEN login_attempts.locked_until > $2 THEN login_attempts.failed_count
                 ELSE login_attempts.failed_count + 1
             END,
             locked_until = CASE
                 WHEN login_attempts.locked_until > $2 THEN login_attempts.locked_until
                 WHEN login_attempts.failed_count + 1 >= $3 THEN $4
                 ELSE NULL
             END,
             last_attempt_at = $2"
    )
    .bind(username)
    .bind(now)
    .bind(MAX_FAILED_LOGIN_ATTEMPTS)
    .bind(lockout_until)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

/// Clears failed login attempts after a successful authentication.
pub async fn clear_login_attempts(pool: &PgPool, username: &str) -> Result<(), Error> {
    sqlx::query("DELETE FROM login_attempts WHERE username = $1")
        .bind(username)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
    Ok(())
}

pub fn hash_password(password: &str) -> Result<String, Error> {
    let salt = SaltString::generate(&mut OsRng);
    // OWASP-recommended minimum for interactive logins: Argon2id, 19 MiB,
    // 2 iterations, 1 parallelism thread. This keeps single-login latency
    // under a few hundred milliseconds on typical hardware while still
    // resisting offline brute force.
    let argon2 = Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        argon2::Params::new(19456, 2, 1, None)
            .map_err(|e| Error::Internal(format!("Argon2 params error: {e}")))?,
    );
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| Error::Internal(format!("Password hashing failed: {e}")))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, Error> {
    let parsed_hash = PasswordHash::new(hash).map_err(|e| Error::Internal(format!("Invalid password hash: {e}")))?;
    let argon2 = Argon2::default();
    Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
}

pub fn is_strong_password(password: &str) -> Result<(), Error> {
    if password.len() < 8 {
        return Err(Error::Validation("Password must be at least 8 characters".into()));
    }
    if !password.chars().any(|c| c.is_ascii_uppercase()) {
        return Err(Error::Validation("Password must contain an uppercase letter".into()));
    }
    if !password.chars().any(|c| c.is_ascii_lowercase()) {
        return Err(Error::Validation("Password must contain a lowercase letter".into()));
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err(Error::Validation("Password must contain a number".into()));
    }
    if !password.chars().any(|c| !c.is_ascii_alphanumeric()) {
        return Err(Error::Validation("Password must contain a special character".into()));
    }
    Ok(())
}

pub fn hash_token(token: &str) -> String {
    use ring::digest::{digest, SHA256};
    let hash = digest(&SHA256, token.as_bytes());
    hex::encode(hash.as_ref())
}

pub fn generate_token() -> String {
    Uuid::new_v4().to_string()
}

pub fn generate_temp_password() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let chars: Vec<char> = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*"
        .chars()
        .collect();
    let mut password = String::new();
    password.push(rng.gen_range('A'..='Z'));
    password.push(rng.gen_range('a'..='z'));
    password.push(rng.gen_range('2'..='9'));
    password.push(*chars.choose(&mut rng).unwrap());
    for _ in 0..8 {
        password.push(*chars.choose(&mut rng).unwrap());
    }
    password
}

pub async fn authenticate(pool: &PgPool, credentials: LoginCredentials) -> Result<(String, User), Error> {
    let now = Utc::now();

    // Enforce account lockout before any password work.
    check_login_lockout(pool, &credentials.username).await?;

    let user: User = match sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
        .bind(&credentials.username)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
    {
        Some(u) => u,
        None => {
            record_failed_login(pool, &credentials.username).await?;
            return Err(Error::Unauthorized);
        }
    };

    if !user.is_active {
        record_failed_login(pool, &credentials.username).await?;
        return Err(Error::Unauthorized);
    }

    if !verify_password(&credentials.password, &user.password_hash)? {
        record_failed_login(pool, &credentials.username).await?;
        return Err(Error::Unauthorized);
    }

    clear_login_attempts(pool, &credentials.username).await?;

    let token = generate_token();
    let token_hash = hash_token(&token);
    let expires_at = now + session_duration();

    sqlx::query(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_active_at) VALUES ($1, $2, $3, $4, $5, $5)"
    )
    .bind(Uuid::new_v4())
    .bind(user.id)
    .bind(&token_hash)
    .bind(expires_at)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    sqlx::query("UPDATE users SET last_login = $1 WHERE id = $2")
        .bind(now)
        .bind(user.id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok((token, user))
}

pub async fn validate_session(pool: &PgPool, token: &str) -> Result<User, Error> {
    let now = Utc::now();
    let token_hash = hash_token(token);
    let session: Session = sqlx::query_as(
        "SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > $2"
    )
    .bind(&token_hash)
    .bind(now)
    .fetch_optional(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or(Error::Unauthorized)?;

    let user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(session.user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or(Error::Unauthorized)?;

    if !user.is_active {
        return Err(Error::Unauthorized);
    }

    sqlx::query("UPDATE sessions SET last_active_at = $1 WHERE id = $2")
        .bind(now)
        .bind(session.id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(user)
}

pub async fn invalidate_session(pool: &PgPool, token: &str) -> Result<(), Error> {
    let token_hash = hash_token(token);
    sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
    Ok(())
}

pub async fn create_user(
    pool: &PgPool,
    full_name: &str,
    username: &str,
    role: Role,
    created_by: Option<Uuid>,
) -> Result<(User, String), Error> {
    let temp_password = generate_temp_password();
    is_strong_password(&temp_password)?;
    let password_hash = hash_password(&temp_password)?;
    let now = Utc::now();
    let id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, $6, $6)"
    )
    .bind(id)
    .bind(username)
    .bind(password_hash)
    .bind(role)
    .bind(full_name)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let user = get_user_by_id(pool, id).await?;

    let _ = created_by;
    Ok((user, temp_password))
}

pub async fn get_user_by_id(pool: &PgPool, id: Uuid) -> Result<User, Error> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or(Error::NotFound)
}

pub async fn list_users(pool: &PgPool) -> Result<Vec<User>, Error> {
    sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
}

pub async fn update_user(pool: &PgPool, id: Uuid, req: UpdateUserRequest) -> Result<User, Error> {
    let user = get_user_by_id(pool, id).await?;
    let full_name = req.full_name.as_ref().unwrap_or(&user.full_name);
    let role = req.role.unwrap_or(user.role);
    let is_active = req.is_active.unwrap_or(user.is_active);
    let now = Utc::now();

    sqlx::query(
        "UPDATE users SET full_name = $1, role = $2, is_active = $3, updated_at = $4 WHERE id = $5"
    )
    .bind(full_name)
    .bind(role)
    .bind(is_active)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    get_user_by_id(pool, id).await
}

pub async fn change_password(pool: &PgPool, id: Uuid, new_password: &str) -> Result<(), Error> {
    is_strong_password(new_password)?;
    let password_hash = hash_password(new_password)?;
    let now = Utc::now();
    sqlx::query(
        "UPDATE users SET password_hash = $1, password_changed_at = $2, must_change_password = FALSE, updated_at = $2 WHERE id = $3"
    )
    .bind(password_hash)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;
    Ok(())
}

pub async fn reset_password(pool: &PgPool, id: Uuid) -> Result<String, Error> {
    let temp_password = generate_temp_password();
    let password_hash = hash_password(&temp_password)?;
    let now = Utc::now();

    sqlx::query(
        "UPDATE users SET password_hash = $1, password_changed_at = $2, must_change_password = TRUE, updated_at = $2 WHERE id = $3"
    )
    .bind(password_hash)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(temp_password)
}

pub async fn ensure_default_users(pool: &PgPool) -> Result<Vec<(String, String)>, Error> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if count > 0 {
        return Ok(vec![]);
    }

    let now = Utc::now();
    let mut created = Vec::new();

    // Default administrator
    let admin_password = "Admin@123".to_string();
    let admin_hash = hash_password(&admin_password)?;
    let admin_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, $6, $6)"
    )
    .bind(admin_id)
    .bind("admin")
    .bind(admin_hash)
    .bind(Role::Admin)
    .bind("System Administrator")
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;
    created.push(("admin".to_string(), admin_password));

    // Default staff / clerk
    let staff_password = "Staff@123".to_string();
    let staff_hash = hash_password(&staff_password)?;
    let staff_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, $6, $6)"
    )
    .bind(staff_id)
    .bind("staff")
    .bind(staff_hash)
    .bind(Role::Clerk)
    .bind("Default Staff User")
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;
    created.push(("staff".to_string(), staff_password));

    Ok(created)
}
