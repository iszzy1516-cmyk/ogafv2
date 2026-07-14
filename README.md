# OAGF SEVERANCE Application

> **Office of the Accountant General of the Federation (OAGF), Nigeria**
>
> A standalone, offline-first pensioner severance data capture and management system.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Workflow Diagrams](#workflow-diagrams)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Prerequisites](#prerequisites)
7. [Getting Started](#getting-started)
8. [Development Commands](#development-commands)
9. [Building for Production](#building-for-production)
10. [GitHub Actions & CI/CD](#github-actions--cicd)
11. [Deployment & Installation](#deployment--installation)
12. [User Roles & Permissions](#user-roles--permissions)
13. [Features](#features)
14. [Database](#database)
15. [Security](#security)
16. [Performance Baseline](#performance-baseline)
17. [Multi-Window Behavior](#multi-window-behavior)
18. [Audit Logging](#audit-logging)
19. [Testing](#testing)
20. [Troubleshooting](#troubleshooting)
21. [Roadmap](#roadmap)
22. [Contributing](#contributing)
23. [License & Ownership](#license--ownership)

---

## Project Overview

The **OAGF SEVERANCE Application** is a desktop system designed for the Office of the Accountant General of the Federation to capture, verify, and manage pensioner severance records locally without any external server or cloud dependency.

The application runs entirely on a local Windows machine (targeted for Windows 10/11). It uses a local **PostgreSQL** database for structured storage and the local filesystem for beneficiary photos and exports.

### Key Objectives

- **Offline by default**: No internet connectivity required.
- **Role-based access control**: Separate interfaces and permissions for Admin, Verifier, and Clerk users.
- **Audit compliance**: Immutable audit logs for every create, update, verify, delete, and export action.
- **Financial auto-calculation**: Real-time computation of gratuity, pension, repatriation, and total due amounts.
- **Local exports**: CSV and Excel export functionality for verified and unverified records.
- **Camera integration**: Capture beneficiary photographs directly from the webcam.

---

## System Architecture

### High-Level Overview

```mermaid
flowchart TB
    subgraph Desktop["Windows Desktop"]
        subgraph TauriShell["Tauri v2 Native Shell"]
            MainUI["Main App UI\nReact + Tailwind"]
            AdminUI["Admin App UI\nReact + Tailwind"]
        end

        subgraph Backend["Shared Rust Backend\ncrates/oagf-backend"]
            Auth["Authentication\nArgon2 + Sessions"]
            Commands["Tauri Commands\nPensioners / Users / Audit / Export"]
            FS["File System\nPhotos / Exports / Backups"]
        end
    end

    PostgreSQL[("PostgreSQL\nLocal Database")]
    LocalFiles[("Local Filesystem\n%LOCALAPPDATA%/OAGF_Pension")]

    MainUI -->|Tauri IPC| Commands
    AdminUI -->|Tauri IPC| Commands
    Commands --> Auth
    Commands --> PostgreSQL
    Commands --> FS
    FS --> LocalFiles
```

### Application Layers

```mermaid
flowchart LR
    subgraph Presentation["Presentation Layer"]
        A["Admin Portal"]
        M["Staff / Main Portal"]
    end

    subgraph Frontend["Frontend Layer"]
        RA["React 18 + Vite"]
        RB["React 18 + Vite"]
        Z["Zustand State"]
        API["API Service Layer"]
    end

    subgraph IPC["Tauri IPC"]
        CMD["Tauri Commands"]
    end

    subgraph Backend["Backend Layer"]
        AUTH["Auth Service"]
        PENSION["Pensioner Service"]
        USER["User Service"]
        AUDIT["Audit Service"]
        EXPORT["Export Service"]
    end

    subgraph Storage["Storage Layer"]
        PG[("PostgreSQL")]
        FILES[("Local Files")]
    end

    A --> RA --> API --> CMD
    M --> RB --> API --> CMD
    CMD --> AUTH & PENSION & USER & AUDIT & EXPORT
    AUTH & PENSION & USER & AUDIT --> PG
    EXPORT --> PG & FILES
```

### Data Flow

```mermaid
sequenceDiagram
    participant User as User
    participant UI as React Frontend
    participant API as API Service
    participant IPC as Tauri IPC
    participant Rust as Rust Backend
    participant DB as PostgreSQL

    User->>UI: Enter pensioner details
    UI->>API: createPensioner(data)
    API->>IPC: Invoke tauri command
    IPC->>Rust: create_pensioner(token, data)
    Rust->>Rust: validate + extract user
    Rust->>DB: INSERT pensioner
    Rust->>DB: INSERT audit_log
    DB-->>Rust: OK
    Rust-->>IPC: Pensioner record
    IPC-->>API: Serialized response
    API-->>UI: Update state
    UI-->>User: Show success + new record
```

---

## Workflow Diagrams

### Authentication & Session Flow

```mermaid
sequenceDiagram
    actor User
    participant Login as Login Page
    participant Store as Auth Store
    participant Rust as Auth Service
    participant DB as PostgreSQL

    User->>Login: Enter credentials
    Login->>Store: login(username, password)
    Store->>Rust: invoke login(credentials)
    Rust->>DB: check login_attempts lockout
    alt Account locked
        Rust-->>Store: Unauthorized
        Store-->>Login: "Invalid username or password"
    else Account not locked
        Rust->>DB: SELECT user
        Rust->>Rust: verify_password
        alt Wrong password
            Rust->>DB: record_failed_login
            Rust-->>Store: Unauthorized
            Store-->>Login: "Invalid username or password"
        else Correct password
            Rust->>DB: clear_login_attempts
            Rust->>DB: INSERT session
            Rust-->>Store: token + user
            Store-->>Login: success
            Login->>Login: route by role + must_change_password
        end
    end
```

### Pensioner Record Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft : Clerk creates record
    Draft --> Unverified : Submitted
    Unverified --> Verified : Verifier/Admin approves
    Unverified --> Rejected : Verifier/Admin rejects
    Verified --> Updated : Admin/Clerk edits
    Rejected --> Unverified : Admin re-opens
    Verified --> [*] : Admin deletes
    Rejected --> [*] : Admin deletes
```

### Verification Workflow

```mermaid
flowchart LR
    A[Clerk creates record] --> B[Status: Unverified]
    B --> C{Verifier reviews}
    C -->|Documents complete| D[Verify]
    C -->|Incomplete/fraudulent| E[Reject]
    D --> F[Status: Verified]
    E --> G[Status: Rejected]
    F --> H[Available for payment]
    G --> I[Returned to clerk for correction]
```

### Export Workflow

```mermaid
flowchart TB
    A[Admin selects export scope] --> B[Build parameterized query]
    B --> C[Stream records from PostgreSQL]
    C --> D{Format}
    D -->|CSV| E[Write UTF-8 BOM + sanitized cells]
    D -->|Excel| F[Write formatted workbook]
    E --> G[Save to exports folder]
    F --> G
    G --> H[Log EXPORT action in audit_logs]
```

### User Management Workflow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin Users Page
    participant Rust as User Service
    participant DB as PostgreSQL

    Admin->>UI: Create user
    UI->>Rust: create_user(full_name, username, role)
    Rust->>Rust: require admin role
    Rust->>Rust: generate_temp_password + hash
    Rust->>DB: INSERT user
    Rust->>DB: INSERT audit_log
    Rust-->>UI: user + temp_password
    UI-->>Admin: Display temp password

    Admin->>UI: Reset password
    UI->>Rust: reset_password(user_id)
    Rust->>DB: UPDATE password_hash
    Rust->>DB: INSERT audit_log
    Rust-->>UI: new temp_password
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Desktop Shell** | Tauri v2 (Rust) | Lightweight native desktop wrapper, secure IPC, Windows `.msi` / `.exe` installers |
| **Frontend** | React 18 + TypeScript + Vite | Component-based UI with fast dev/build |
| **Styling** | Tailwind CSS 4 | Utility-first styling matching Nigeria government design language |
| **State Management** | Zustand | Lightweight global and UI state |
| **Shared UI Library** | `shared/ui` workspace | Reusable components, auth store, API services |
| **Backend** | Rust (`oagf-backend` crate) | Tauri commands, business logic, file exports |
| **Database** | PostgreSQL 14+ | Local structured storage |
| **Database Driver** | `sqlx` | Async, compile-time checked SQL queries |
| **Password Hashing** | Argon2id | OWASP-recommended password hashing |
| **Session Tokens** | UUID v4 | Secure local session tokens |
| **CSV Export** | `csv` + `chrono` crates | Fast streaming CSV generation |
| **Excel Export** | `rust_xlsxwriter` | Excel-compatible spreadsheet exports |
| **Camera Capture** | WebRTC `getUserMedia()` | Browser-based webcam access inside Tauri WebView |
| **Testing** | `cargo test` + custom test DBs | Security, concurrency, performance, multi-window tests |

### Design System

The UI follows a Nigeria government / OAGF brand identity:

| Token | Value | Usage |
|-------|-------|-------|
| Primary Green | `#1B7A3E` | Header, primary buttons, active states |
| Dark Green | `#145A2E` | Hover states, admin accents |
| Light Green | `#E8F5E9` | Section backgrounds, alerts |
| Gold/Amber | `#F4A261` | Warnings, pending statuses |
| Danger Red | `#DC3545` | Delete, reject, errors |
| Off-White | `#F8F9FA` | App background |
| White | `#FFFFFF` | Card backgrounds, form fields |
| Text Dark | `#212529` | Primary text |
| Text Grey | `#6C757D` | Labels, placeholders |

---

## Project Structure

```text
OAGF/
├── .github/
│   └── workflows/
│       └── release.yml           # CI/CD: builds real + demo Windows installers
├── apps/
│   ├── admin/                    # Admin desktop application (React + Tauri)
│   │   ├── src/                  # React frontend source
│   │   ├── src-tauri/            # Tauri Rust wrapper for admin app
│   │   │   ├── tauri.conf.json
│   │   │   └── tauri.demo.conf.json
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── main/                     # Main desktop application (clerk/data entry)
│       ├── src/                  # React frontend source
│       ├── src-tauri/            # Tauri Rust wrapper for main app
│       │   ├── tauri.conf.json
│       │   └── tauri.demo.conf.json
│       ├── package.json
│       └── vite.config.ts
├── crates/
│   └── oagf-backend/             # Shared Rust backend crate
│       ├── migrations/           # PostgreSQL schema migrations
│       ├── src/
│       │   ├── commands/         # Tauri command handlers
│       │   ├── db/               # Database pool + directories
│       │   ├── export/           # CSV / Excel export services
│       │   ├── models/           # Domain models (money, users, pensioners)
│       │   ├── auth/             # Authentication, sessions, RBAC
│       │   ├── fs/               # File system helpers
│       │   ├── audit/            # Audit logging
│       │   └── lib.rs            # Library entry point
│       ├── tests/                # Integration tests
│       │   ├── security.rs
│       │   ├── concurrency.rs
│       │   ├── performance.rs
│       │   └── multi_window.rs
│       └── Cargo.toml
├── shared/
│   └── ui/                       # Shared React component library
│       ├── src/
│       │   ├── components/       # Reusable UI primitives
│       │   ├── services/         # API/Tauri service layer and mock helpers
│       │   ├── store/            # Zustand stores
│       │   └── types/            # Shared TypeScript types
│       └── package.json
├── tests/
│   └── e2e/                      # End-to-end tests (if any)
├── Cargo.toml                    # Rust workspace manifest
├── package.json                  # npm workspace scripts
├── README.md                     # This file
├── SECURITY_AUDIT.md             # Security hardening & performance audit
└── prompt.md                     # Original system specification
```

---

## Prerequisites

Before you begin, ensure you have the following installed on your development machine:

1. **Node.js** (v20 or later) + **npm** v10 or later
2. **Rust** toolchain (stable) — install via [rustup.rs](https://rustup.rs/)
3. **PostgreSQL** 14+ (local instance)
4. **Tauri v2 CLI** prerequisites:
   - Linux: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libgtk-3-dev`, `libappindicator3-dev`, `librsvg2-dev`
   - Windows: WebView2 runtime (included on Windows 10/11), Microsoft Visual Studio C++ Build Tools
5. **Git**

### Verify Your Environment

```bash
node --version      # Should print v20.x or later
npm --version       # Should print v10.x or later
rustc --version     # Should print stable Rust version
cargo --version     # Should print cargo version
psql --version      # Should print PostgreSQL version
```

### Database Setup

Create the application database:

```bash
sudo -u postgres psql -c "CREATE DATABASE oagf_pension;"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

The backend will automatically run migrations on first launch.

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/iszzy1516-cmyk/OGAF.git
cd OAGF
```

### 2. Install Dependencies

```bash
npm install
```

This installs dependencies for the root workspace, `shared/ui`, `apps/main`, and `apps/admin`.

### 3. Run the Rust Backend in Development

The Rust backend is compiled automatically when Tauri starts, but you can also build it directly:

```bash
cargo build
```

---

## Development Commands

All commands should be run from the project root unless stated otherwise.

### Run Main App (Frontend Only)

```bash
npm run dev:main
```

This starts the Vite dev server for the main app. By default it runs on port `1420`.

> **Note:** When running in the browser directly (not through Tauri), the frontend cannot reach the local Rust backend. Use `VITE_USE_MOCK_TAURI=true` to start the dev server with an in-memory mock backend for UI development only.

### Run Admin App (Frontend Only)

```bash
npm run dev:admin
```

By default this runs on port `1422`.

### Run Main App as a Desktop App (Tauri)

```bash
npm run tauri:main
```

This builds the Rust backend and opens the main app in a native Tauri window.

### Run Admin App as a Desktop App (Tauri)

```bash
npm run tauri:admin
```

### Build Frontend Assets Only

```bash
npm run build
```

This compiles both the main and admin React apps to their respective `dist/` folders.

### Run Backend Tests

```bash
# Create the test database once
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE oagf_pension_test;"

# Run all backend tests
DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend
```

---

## Building for Production

### Build Windows Installer (.msi) and .exe

#### Main App Installer

```bash
npm run tauri:build:main
```

#### Admin App Installer

```bash
npm run tauri:build:admin
```

The generated installers will be located in:

```text
apps/main/src-tauri/target/release/bundle/msi/
apps/main/src-tauri/target/release/bundle/nsis/

apps/admin/src-tauri/target/release/bundle/msi/
apps/admin/src-tauri/target/release/bundle/nsis/
```

### Frontend Production Build

If you only need the static frontend assets (for browser preview or CI):

```bash
npm run build
```

Output:

```text
apps/main/dist/
apps/admin/dist/
```

### Demo / Client Preview Builds

For a self-contained installer that runs without PostgreSQL or a real backend, use the demo build. It bundles the mock data layer and works entirely offline:

```bash
# Main app demo installer
npm run tauri:build:demo:main

# Admin app demo installer
npm run tauri:build:demo:admin
```

Demo installers are named with "Demo" suffix (e.g. `OAGF SEVERANCE Demo_0.1.0_x64_en-US.msi`) and install with a separate application identifier so they coexist with the production app.

**Demo logins:**

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin@123` | Admin |
| `verifier` | `Verifier@123` | Verifier |
| `clerk` | `Clerk@123` | Clerk |

---

## GitHub Actions & CI/CD

The repository includes `.github/workflows/release.yml`. It runs on every push to `main`/`master`, pull request, and manual workflow dispatch.

### What It Builds

| Matrix | Output Artifacts |
|--------|------------------|
| Staff app (real) | `OAGF-Pension-Staff-MSI`, `OAGF-Pension-Staff-Setup` |
| Admin app (real) | `OAGF-Pension-Admin-MSI`, `OAGF-Pension-Admin-Setup` |
| Staff app (demo) | `OAGF-Pension-Staff-Demo-MSI`, `OAGF-Pension-Staff-Demo-Setup` |
| Admin app (demo) | `OAGF-Pension-Admin-Demo-MSI`, `OAGF-Pension-Admin-Demo-Setup` |

### Build Steps

```mermaid
flowchart LR
    A[Checkout] --> B[Setup Node.js]
    B --> C[Install Rust]
    C --> D[npm ci]
    D --> E{Demo?}
    E -->|No| F[npm run tauri:build:<app>]
    E -->|Yes| G[npm run tauri:build:demo:<app>]
    F --> H[Upload MSI + EXE artifacts]
    G --> H
```

To trigger a build manually:

1. Go to **Actions** → **Build Windows Installers**.
2. Click **Run workflow**.
3. Select the branch and click **Run workflow**.

After the run completes, download the artifacts from the workflow summary page.

### Creating a GitHub Release

To publish installers on the repository's **Releases** page (permanent download links):

**Option A — Push a version tag (recommended):**

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

The workflow will build all installers and create a release named **OAGF SEVERANCE v0.1.0** with the MSI/EXE files attached.

**Option B — Manual release with a custom tag:**

1. Go to **Actions** → **Build Windows Installers**.
2. Click **Run workflow**.
3. Select the branch.
4. Enter a tag in the **release_tag** field, e.g. `v0.1.0-preview`.
5. Click **Run workflow**.

The release will appear at `https://github.com/iszzy1516-cmyk/OGAF/releases`.

---

## Deployment & Installation

### Windows Installation

1. Download the appropriate `.msi` or `.exe` from the **Releases** page or the workflow artifacts.
2. Run the installer on the target Windows machine.
3. The installer will create:
   - Application shortcuts
   - Local data directories under `%LOCALAPPDATA%\OAGF_Pension\`
4. Ensure PostgreSQL is installed and running locally.
5. Create the `oagf_pension` database (the app will run migrations automatically).
6. Launch the app and sign in.

### Production Default Credentials

On a fresh database, the backend seeds two default accounts:

| Username | Password | Role | Must change password |
|----------|----------|------|---------------------|
| `admin` | `Admin@123` | Admin | Yes |
| `staff` | `Staff@123` | Clerk | Yes |

Both accounts are forced to change their password on first login.

### Local Data Paths

After installation, the application stores data in the following locations:

```text
%LOCALAPPDATA%\OAGF_Pension\
├── photos\                 # Beneficiary photographs
├── exports\                # CSV / Excel export outputs
└── backups\                # Database backups
```

> **Important:** Back up the PostgreSQL database and `photos/` folder regularly. The admin panel provides a one-click backup function.

---

## User Roles & Permissions

The system supports three user roles:

| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin** | System administrator | Full access: manage users, view audit logs, export all data, backup/restore database, delete records |
| **Verifier** | Senior officer who validates records | View records, verify/reject pensioner records, add verification notes |
| **Clerk** | Data entry officer | Create new pensioner records, edit own records, view unverified/verified lists |

### Authentication Rules

- Passwords must be at least 8 characters and include uppercase, lowercase, number, and special character.
- Passwords are hashed using **Argon2id** before storage.
- Accounts are locked for 15 minutes after 5 failed login attempts.
- Sessions timeout after **15 minutes of inactivity**.
- Every backend command checks the user's role before executing.

---

## Features

### Main App (Data Entry / Clerk / Verifier)

1. **Login Screen**
   - Username and password authentication
   - Password visibility toggle
   - Session expiry handling
   - Change-password on first login

2. **Evaluation Form**
   - Personal information (name, gender, DOB, location, zone, photo capture)
   - Employment & service records (MDA, grade, step, appointment/promotion/retirement dates)
   - Financial information (APA, gratuity, pension, repatriation, contributions, amount paid)
   - Real-time auto-calculation of:
     - 10% Gratuity
     - 10% Pension
     - Amount Owed
     - Due for Payment by OAGF
   - Banking information (bank name, account number, sort code, address)
   - Next of Kin details
   - Submit and clear form

3. **Unverified Pensioners List**
   - Table of records awaiting verification
   - Search, pagination
   - Actions: Verify, Edit, Delete

4. **Verified Pensioners Master List**
   - Read-only view for clerks
   - Verifiers can add notes
   - Search, pagination

### Admin App (Management Dashboard)

1. **Dashboard Overview**
   - Total pensioners count
   - Unverified count
   - Verified count
   - Total liability (sum of all amounts due)
   - Total amount paid by OAGF
   - Recent activity and storage summary widgets

2. **Records Collection**
   - Unified view of all pensioner records
   - Advanced filtering and search
   - Edit/verify/delete capabilities

3. **User Management**
   - Add, edit, deactivate, reset password, delete staff users
   - Auto-generated temporary passwords for new users
   - Admin cannot delete their own account

4. **Audit Log Viewer**
   - Filterable table of all system actions
   - Expandable JSON diff showing old vs new values
   - Export audit log to CSV

5. **Export Center**
   - Export all records
   - Export verified only
   - Export unverified only
   - Export by date range, MDA, or zone
   - All exports are logged in the audit trail

6. **Database Management**
   - One-click database backup
   - Storage information (DB size, photo folder size, record count)

---

## Database

The application uses **PostgreSQL** as the local database. All schema migrations are applied automatically on first launch.

### Core Tables

- **`users`** — Staff accounts, roles, password hashes, session metadata
- **`pensioners`** — Core pensioner severance records
- **`audit_logs`** — Immutable audit trail of all actions
- **`sessions`** — Active login session tokens
- **`login_attempts`** — Failed login tracking for brute-force protection

### Auto-Calculated Fields

The backend computes the following derived financial fields:

- `ten_percent_gratuity` = `gratuity × 0.10`
- `ten_percent_pension` = `pension × 0.10`
- `due_for_payment_by_oagf` = `(gratuity + pension + repatriation + total_employee_contribution_due) - amount_paid_by_oagf`

### Connection

The backend reads the `DATABASE_URL` environment variable and falls back to:

```text
postgres://postgres:postgres@localhost:5432/oagf_pension
```

### Migrations

Migrations live in `crates/oagf-backend/migrations/` and are applied by `sqlx migrate` on startup.

---

## Security

This application handles sensitive financial and personal data. See `SECURITY_AUDIT.md` for the full audit report, regression tests, and performance baseline.

### Implemented Protections

- **Argon2id** password hashing (OWASP-recommended params)
- **Account lockout** after 5 failed login attempts
- **Role-based access control (RBAC)** enforced at the Rust command layer
- **UUID-based session tokens** stored server-side
- **SQL injection protection** via parameterized `sqlx` queries (QueryBuilder)
- **Path traversal protection** for file exports
- **Race-condition hardening** on verify/reject with atomic SQL updates
- **Audit logging** of all state-changing operations
- **CSV formula injection protection** during export
- **Secure photo filenames** using UUIDs (no beneficiary names in file paths)
- **Input validation** performed on both frontend and backend

### Session Management

- Tokens are held in application memory, not `localStorage`
- Sessions expire after 15 minutes of inactivity
- Logout invalidates the current session token on the backend
- Multiple logins create independent session tokens

---

## Performance Baseline

Measured against `oagf_pension_test` with 1,000 pensioner records:

| Flow | p50 | p95 | p99 |
|------|-----|-----|-----|
| Login | 517 ms | 522 ms | 522 ms |
| List pensioners (page 1, no search) | 1.61 ms | 2.12 ms | 3.55 ms |
| Search pensioners | 4.45 ms | 5.43 ms | 5.93 ms |
| Dashboard stats | 2.39 ms | 2.66 ms | 2.80 ms |

Login latency is dominated by Argon2 verification. All database queries are sub-10 ms.

---

## Multi-Window Behavior

| Scenario | Current Behaviour |
|----------|-------------------|
| Same user logged in twice | Two independent session tokens are created |
| Logout in one window | Only that token is invalidated; other windows stay signed in |
| Session expiry | Enforced globally by the database; expired tokens rejected everywhere |
| Session lock | Frontend-only via Zustand. A second window opened while the first is locked will not be locked unless backend enforcement is added. |

---

## Audit Logging

Every significant action is recorded in the `audit_logs` table with:

- User ID and name
- Action type (`LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `VERIFY`, `DELETE`, `EXPORT_CSV`, `EXPORT_EXCEL`, etc.)
- Affected table and record ID
- `old_values` and `new_values` as JSON snapshots
- Timestamp

### Actions That Trigger Audit Logs

- Login / Logout
- Create, update, verify, reject, or delete a pensioner record
- Create, update, or delete a user
- Export records to CSV or Excel
- Backup the database
- Password reset

---

## Testing

The backend includes integration tests covering security, concurrency, performance, and multi-window behavior.

### Test Suites

| File | Coverage |
|------|----------|
| `tests/security.rs` | SQL injection neutralization, login lockout, atomic verify, RBAC |
| `tests/concurrency.rs` | Concurrent logins, concurrent creates, verify race conditions, concurrent list queries |
| `tests/performance.rs` | Latency baseline for login, list, search, dashboard |
| `tests/multi_window.rs` | Independent sessions, global session expiry |

### Running Tests

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

---

## Troubleshooting

### Port Already in Use

If you see:

```text
Error: Port 1420 is already in use
```

Kill the process using the port, or start the app on a different port:

```bash
# Find the process
lsof -i :1420

# Kill it
kill -9 <PID>
```

### `window.__TAURI_INTERNALS__ is undefined`

This error occurs when the frontend is opened in a regular browser instead of the Tauri WebView. The application requires the Tauri desktop shell to access the local backend.

To test the frontend in a browser without the desktop shell, start the dev server with the mock backend:

```bash
VITE_USE_MOCK_TAURI=true npm run dev:main
```

This uses an in-memory mock and is intended for UI development only.

### Tauri CLI Not Found

If `tauri` is not found, install the Tauri CLI globally:

```bash
cargo install tauri-cli --version "^2.0"
```

Or use `npx tauri` instead.

### Database Connection Failed

Ensure PostgreSQL is running and the database exists:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -c "SELECT 1 FROM pg_database WHERE datname = 'oagf_pension';"
```

If not, create it:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE oagf_pension;"
```

### Account Locked Out

If an account is locked due to failed login attempts, wait 15 minutes or reset the password via another admin account.

---

## Roadmap

### Completed

- [x] Tauri v2 + React + TypeScript workspace
- [x] Shared Rust backend crate
- [x] Main and Admin frontend applications
- [x] PostgreSQL database with migrations
- [x] Login, role-based routing, and password change on first login
- [x] Evaluation form with auto-calculation
- [x] Verified and unverified pensioner lists
- [x] Admin dashboard, user management, audit logs, export center, database tools
- [x] UI cleanup: removed demo badges, stickers, emojis, auto-login
- [x] Nigerian Coat of Arms branding integration
- [x] CSV and Excel export services
- [x] Security audit: SQL injection fixes, brute-force protection, race-condition hardening, path-traversal protection
- [x] Backend integration tests (security, concurrency, performance, multi-window)
- [x] GitHub Actions CI/CD for Windows installers
- [x] Demo / client-preview builds

### In Progress / Planned

- [ ] Backend-enforced session screen lock across multiple windows
- [ ] End-to-end test coverage
- [ ] User manual PDF
- [ ] Linux and macOS installer builds
- [ ] Automated database backup scheduling

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes.
4. Run the build to ensure both apps compile:

```bash
npm run build
```

5. Run backend tests:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/oagf_pension_test cargo test -p oagf-backend
```

6. Commit your changes with a clear message.
7. Push to your fork and open a pull request.

### Commit Message Convention

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, no logic changes)
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks
- `security:` — Security hardening or fixes

---

## License & Ownership

This software is proprietary and owned by the **Office of the Accountant General of the Federation (OAGF), Nigeria**. Unauthorized distribution, modification, or deployment outside OAGF systems is strictly prohibited.

---

## Support

For technical support, contact the OAGF IT Division or the project maintainer.

---

*README Version: 2.0*  
*Application Version: 0.1.0*  
*Last Updated: 2026-07-12*
# ogafv2
