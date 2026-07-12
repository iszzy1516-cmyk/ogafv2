# OAGF Pension Backend — Security & Performance Audit

Date: 2026-07-12  
Scope: Rust backend (`crates/oagf-backend`), PostgreSQL persistence layer, and session model used by both Tauri apps.

## 1. Critical Findings Fixed

### 1.1 SQL injection in list/search and export queries
**Risk:** High — any authenticated user could read, modify, or delete database records by sending crafted search strings, MDA names, zone names, or audit-log action filters.

**Affected code (before fix):**
- `crates/oagf-backend/src/commands/pensioners.rs` — `list_pensioners`
- `crates/oagf-backend/src/commands/audit.rs` — `list_audit_logs`
- `crates/oagf-backend/src/export/service.rs` — `build_pensioner_where`, `build_audit_where`, `export_csv`, `export_excel`

**Fix:** Replaced string concatenation with `sqlx::QueryBuilder` and parameter binding for every user-supplied value. Wildcard characters inside `LIKE` patterns are escaped with `ESCAPE '\'`.

**Regression tests:**
- `crates/oagf-backend/tests/security.rs::sql_injection_in_pensioner_search_is_neutralized`
- `crates/oagf-backend/tests/security.rs::sql_injection_in_audit_action_filter_is_neutralized`

### 1.2 Race condition on verify/reject
**Risk:** Medium — two verifiers clicking “Verify” at the same time could both succeed, with the second overwriting the first verifier’s identity and timestamp.

**Fix:** Changed `verify_pensioner` and `reject_pensioner` to a single atomic `UPDATE ... WHERE id = $1 AND status = 'Unverified' RETURNING *`. Only one concurrent call can win.

**Regression test:** `crates/oagf-backend/tests/security.rs::verify_pensioner_is_atomic_against_double_verify`

### 1.3 No brute-force protection
**Risk:** High — login endpoints allowed unlimited password guesses with no lockout or rate limiting.

**Fix:** Added migration `003__login_attempts.sql` and account lockout logic in `auth::authenticate`:
- 5 failed attempts lock the account for 15 minutes.
- Successful login clears the failure history.
- Lockout is checked before password hashing to avoid unnecessary CPU work.

**Regression test:** `crates/oagf-backend/tests/security.rs::repeated_failed_logins_lock_account`

### 1.4 Path traversal in exports
**Risk:** Medium — `export_csv`/`export_excel` accepted an arbitrary directory path from the frontend and wrote files there, potentially escaping the intended exports folder.

**Fix:** Added `resolve_export_target` in `commands/export.rs` that:
- Requires absolute paths.
- Canonicalizes the resolved file path.
- Rejects any target that falls outside the requested/export base directory.

File-name sanitization (`fs::sanitize_filename`) was already in place and remains active.

## 2. Additional Hardening

### 2.1 Password hashing tuned for interactive login
Original Argon2id params (`m=65536, t=3, p=4`) produced login latency of ~2.7 s on the target hardware. Tuned to OWASP-recommended minimum for interactive use (`m=19456, t=2, p=1`), which reduced median login latency to ~520 ms while still resisting offline brute force.

**Note:** Existing password hashes are parameterised, so old hashes still verify; only newly created/changed passwords use the faster params. The default `staff` account hash in the production database has been regenerated with the new params.

### 2.2 Input validation on pensioner records
Added length limits and range checks in `validate_pensioner`:
- Full name required and capped at 255 chars.
- Account number must be 10 digits.
- Years of service 0–100; months of service 0–11.
- Common text fields capped at 255 chars to prevent oversized payloads.

### 2.3 Pool sizing
`PgPoolOptions::max_connections` is currently 10. This is adequate for a single-user desktop app but should be raised or made configurable if the backend is ever shared by many concurrent staff stations.

## 3. Performance Baseline

Measured against `oagf_pension_test` with 1,000 pensioner records:

| Flow | p50 | p95 | p99 |
|------|-----|-----|-----|
| Login | 517 ms | 522 ms | 522 ms |
| List pensioners (page 1, no search) | 1.61 ms | 2.12 ms | 3.55 ms |
| Search pensioners | 4.45 ms | 5.43 ms | 5.93 ms |
| Dashboard stats | 2.39 ms | 2.66 ms | 2.80 ms |

Database queries themselves are fast; login latency is dominated by Argon2 verification.

## 4. Concurrency Results

| Scenario | Result |
|----------|--------|
| 20 concurrent logins (same user) | All 20 succeed, independent sessions |
| 50 concurrent `create_pensioner` | All 50 records persist |
| 10 concurrent verify of same record | Exactly 1 succeeds |
| 30 concurrent list queries | Consistent counts |

## 5. Multi-Window Behavior

| Scenario | Current behaviour |
|----------|-------------------|
| Same user logged in twice | Two independent session tokens |
| Logout in one window | Only that token is invalidated; other windows stay signed in |
| Session expiry | Enforced globally by the database; expired tokens rejected everywhere |
| Session lock | **Frontend-only** via Zustand; the backend does not enforce a screen lock. A second window opened while the first is locked will not be locked unless the frontend state is shared. This is a known limitation to address if strict screen-lock compliance is required. |

## 6. Remaining Recommendations

1. **Backend-enforced session lock.** If the client requires a mandatory screen lock after inactivity, implement a `locked_at` column on `sessions` and validate it in `validate_session`.
2. **Configurable connection pool.** Move `max_connections` to an environment variable or config file.
3. **Sign-out everywhere.** Add an admin/user command to invalidate all sessions for a given user.
4. **Frontend security review.** Audit React routes and auth store for token leakage, XSS sinks, and dependency vulnerabilities (`npm audit`).
5. **Backup encryption.** Exports/backups currently write plaintext CSV/Excel; consider encrypting at rest if sensitive.
6. **Run tests in CI.** Add the test commands below to GitHub Actions so regressions are caught automatically.

## 7. How to Run the Tests

```bash
# Create the test database once
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE oagf_pension_test;"

# Run all backend tests
DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend

# Run specific suites
DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend --test security
DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend --test concurrency
DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend --test performance
DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend --test multi_window
```

## 8. Files Changed

- `crates/oagf-backend/src/auth/service.rs` — lockout logic, Argon2 tuning.
- `crates/oagf-backend/src/commands/pensioners.rs` — parameterised list query, atomic verify/reject, input validation.
- `crates/oagf-backend/src/commands/audit.rs` — parameterised audit-log query.
- `crates/oagf-backend/src/commands/export.rs` — path-traversal protection.
- `crates/oagf-backend/src/export/service.rs` — parameterised export queries.
- `crates/oagf-backend/src/fs/mod.rs` — `normalize_path` helper.
- `crates/oagf-backend/src/lib.rs` — `BackendState::for_testing` helper.
- `crates/oagf-backend/migrations/003__login_attempts.sql` — new lockout table.
- `crates/oagf-backend/tests/security.rs` — SQL injection, lockout, atomic verify, RBAC tests.
- `crates/oagf-backend/tests/concurrency.rs` — concurrent login/create/verify/list tests.
- `crates/oagf-backend/tests/performance.rs` — latency baseline tests.
- `crates/oagf-backend/tests/multi_window.rs` — multi-session behaviour tests.
- `SECURITY_AUDIT.md` — this report.
