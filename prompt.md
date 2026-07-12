# OAGF Pension Severance Desktop Application — System Specification

## 1. Project Overview
Build a **standalone, offline desktop application** for capturing and managing pensioner severance data for the **Office of the Accountant General of the Federation (OAGF), Nigeria**. The application must run entirely on local Windows machines with **no internet dependency, no cloud hosting, and no external backend servers**.

All data (PostgreSQL database, beneficiary photos, CSV exports) must reside on the local filesystem. The app must support multiple user roles with strict access control, comprehensive audit logging, and financial auto-calculation.

---

## 2. Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Desktop Shell** | Tauri v2 (Rust) | Tiny binary (~3-5MB), native performance, secure IPC, Windows `.msi` installer |
| **Frontend UI** | React 18 + Tailwind CSS | Component-based, responsive, easy to match Nigeria government design style |
| **Database** | Embedded PostgreSQL (via `postgresql-embedded` or `pg-embed` crate) | Zero external hosting, ACID compliance, generated columns for auto-calc |
| **Database Driver** | `sqlx` (async, compile-time checked) | Type-safe queries, PostgreSQL native |
| **Password Hashing** | Argon2id (via `argon2` crate) | OWASP recommended, resistant to GPU/ASIC attacks |
| **Session Tokens** | UUID v4 + `ring` (HMAC) | Cryptographically secure local sessions |
| **CSV Export** | `csv` crate + `chrono` | Fast, zero-alloc streaming writes |
| **Camera Capture** | WebRTC `getUserMedia()` (frontend) + Tauri FS API (Rust) | Native webcam access, save to local `photos/` |
| **Excel Export** | `rust_xlsxwriter` (optional) | Back-office compatibility |
| **State Management** | Zustand (React) | Lightweight, persists UI state |

---

## 3. Design System — "Nigeria Government Style"

The UI must visually match the existing OAGF Severance application aesthetic with modern improvements.

### Color Palette
```
Primary Green:    #1B7A3E  (Header, primary buttons, active states)
Dark Green:       #145A2E  (Hover states, admin accents)
Light Green:      #E8F5E9  (Section backgrounds, alerts)
Gold/Amber:       #F4A261  (Warnings, pending statuses)
White:            #FFFFFF  (Card backgrounds, form fields)
Off-White:        #F8F9FA  (App background)
Text Dark:        #212529  (Primary text)
Text Grey:        #6C757D  (Labels, placeholders)
Border Grey:      #DEE2E6  (Input borders, dividers)
Danger Red:       #DC3545  (Delete, reject, errors)
```

### Typography
- **Primary Font**: Inter or system-ui stack
- **Data/Numbers**: Tabular figures (monospace) for financial columns to ensure alignment
- **Headers**: 24px bold (section titles), 18px semibold (card titles)
- **Body**: 14px regular, line-height 1.5
- **Currency**: Always display Naira (₦) symbol with comma-separated thousands and 2 decimal places: `₦512,718.96`

### Layout Patterns
- **Top Navigation Bar**: Green (#1B7A3E) with OAGF logo (left), navigation tabs (center-right): `Evaluation | Verified List | Unverified | Admin`
- **Section Cards**: White cards with subtle shadow (`shadow-sm`), rounded corners (`rounded-lg`), grey left-border accent for section headers
- **Form Sections**: Numbered headers (1. Personal Information, 2. Employment & Service Records, etc.) with light grey background bars
- **Data Tables**: Striped rows, sortable headers with arrow icons, pagination (10/25/50/100 entries), search box top-right
- **Action Buttons**: 
  - Primary: Green pill/rounded (`bg-[#1B7A3E]`, white text)
  - Secondary: Grey outline
  - Danger: Red outline (Delete)
  - Success: Light green (Verify)

---

## 4. Database Schema (PostgreSQL)

Use **UUID v7** (or v4) for all primary keys and user IDs. No sequential integers exposed anywhere.

### 4.1 Users Table (Staff Authentication)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,        -- Argon2id hash
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'verifier', 'clerk')),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4.2 Audit Logs Table (Immutable)
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(100),                     -- Denormalized for integrity
    action VARCHAR(50) NOT NULL,                -- LOGIN, LOGOUT, CREATE, UPDATE, VERIFY, DELETE, EXPORT_CSV, EXPORT_EXCEL
    table_name VARCHAR(50),
    record_id UUID,                             -- UUID of affected record
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),                     -- Localhost or machine identifier
    session_id UUID,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, performed_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, performed_at DESC);
CREATE INDEX idx_audit_record ON audit_logs(table_name, record_id);
```

### 4.3 Pensioners Table (Core Data)
```sql
CREATE TABLE pensioners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 1. PERSONAL INFORMATION
    full_name VARCHAR(150) NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth DATE,
    location VARCHAR(100),
    zone VARCHAR(50),
    photo_path VARCHAR(255),                    -- Local filesystem path: photos/{uuid}_{lastname}.jpg

    -- 2. EMPLOYMENT & SERVICE RECORDS
    salary_structure VARCHAR(50),
    mda_name VARCHAR(100),                      -- Ministry/Department/Agency
    grade VARCHAR(20),
    step VARCHAR(10),
    first_appointment_date DATE,
    last_promotion_date DATE,
    retirement_date DATE,
    years_of_service INTEGER,
    months_of_service INTEGER,

    -- 3. FINANCIAL & PAYMENT INFORMATION (Inputs)
    apa DECIMAL(15,2) DEFAULT 0,                -- Accrued Pension Allowance
    gratuity DECIMAL(15,2) DEFAULT 0,
    pension DECIMAL(15,2) DEFAULT 0,
    repatriation DECIMAL(15,2) DEFAULT 0,
    total_employee_contribution_due DECIMAL(15,2) DEFAULT 0,
    amount_owed DECIMAL(15,2) DEFAULT 0,      -- Manual or calculated
    amount_owed_to_mda DECIMAL(15,2) DEFAULT 0,
    amount_paid_by_oagf DECIMAL(15,2) DEFAULT 0,

    -- Auto-Calculated Fields (PostgreSQL Generated Columns)
    ten_percent_gratuity DECIMAL(15,2) GENERATED ALWAYS AS (ROUND(gratuity * 0.10, 2)) STORED,
    ten_percent_pension DECIMAL(15,2) GENERATED ALWAYS AS (ROUND(pension * 0.10, 2)) STORED,

    -- Calculated Total Due (adjust formula as needed)
    due_for_payment_by_oagf DECIMAL(15,2) GENERATED ALWAYS AS (
        ROUND((COALESCE(gratuity,0) + COALESCE(pension,0) + COALESCE(repatriation,0) + COALESCE(apa,0) + COALESCE(total_employee_contribution_due,0)) - COALESCE(amount_paid_by_oagf,0), 2)
    ) STORED,

    -- 4. BANKING INFORMATION
    bank_name VARCHAR(100),
    account_number VARCHAR(20),
    sort_code VARCHAR(20),
    bank_address TEXT,

    -- 5. NEXT OF KIN & VERIFICATION
    nok_name VARCHAR(150),
    nok_phone VARCHAR(20),
    nok_relation VARCHAR(50),
    nok_payment BOOLEAN DEFAULT FALSE,

    -- WORKFLOW & METADATA
    status VARCHAR(20) DEFAULT 'Unverified' CHECK (status IN ('Unverified', 'Verified', 'Rejected')),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,

    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pensioners_status ON pensioners(status);
CREATE INDEX idx_pensioners_name ON pensioners USING gin(to_tsvector('simple', full_name));
CREATE INDEX idx_pensioners_mda ON pensioners(mda_name);
CREATE INDEX idx_pensioners_created ON pensioners(created_at DESC);
```

### 4.4 Sessions Table (Server-side session tracking)
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,            -- SHA-256 of the token presented to client
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 5. Security Requirements (Non-Negotiable)

### 5.1 Authentication & Authorization
- **Argon2id** must be used for all password hashing with parameters: `memory_cost=65536 (64MB)`, `time_cost=3`, `parallelism=4`.
- Passwords must enforce minimum strength: 8+ characters, uppercase, lowercase, number, special character.
- **UUID-based session tokens** (v4) stored server-side (sessions table). Client holds token in memory only (not localStorage for security).
- Session timeout: **15 minutes of inactivity**. Auto-lock screen with re-authentication required.
- Maximum 5 failed login attempts → account lockout for 30 minutes (tracked in memory or DB).
- **Role-Based Access Control (RBAC)** enforced at the Rust command layer. Every command must verify the user's role before executing.

### 5.2 Data Protection
- **Sensitive fields** (account_number, nok_phone) should be encrypted at application level using AES-256-GCM before storage if possible, or at minimum masked in UI (show last 4 digits only to clerks).
- **Photo filenames**: Random UUID-based names, never include beneficiary name in filesystem name to prevent directory enumeration attacks.
- **Database file**: Stored in `%LOCALAPPDATA%/OAGF_Pension/pg_data/` — not easily accessible to casual users.
- **No plaintext secrets**: Database connection strings, encryption keys managed via Tauri secure store or OS keychain.

### 5.3 Audit & Compliance
- **Immutable audit logs**: Every CREATE, UPDATE, VERIFY, DELETE, EXPORT action logged with before/after snapshots (JSONB).
- Admin cannot delete or modify audit_logs entries.
- Export operations must log: who exported, what filter was used, timestamp, and number of records.
- Financial figure changes must store both `old_values` and `new_values` in audit_logs for fraud detection.

### 5.4 Application Security
- **Input Validation**: All frontend inputs validated again in Rust backend. SQL injection prevented via `sqlx` parameterized queries.
- **File Upload**: Camera photos validated (JPEG only, max 5MB, scanned for basic integrity). Save outside web-accessible paths.
- **CSV Injection Protection**: When exporting, prepend dangerous formula characters (`=`, `+`, `-`, `@`, `	`, ``) with a single quote to prevent Excel formula injection attacks.

---

## 6. Application Modules & Features

### 6.1 Authentication Module
- Login screen: OAGF logo, username/password fields, green submit button.
- Password visibility toggle.
- "Session Expired" modal overlay when auto-lock triggers.
- First-run setup: If no admin exists, force creation of default admin account before app usage.

### 6.2 Evaluation Form (Data Entry)
Multi-section scrollable form with **real-time auto-calculation**.

**Section 1: Personal Information**
- Full Name (text, required)
- Gender (dropdown: Male/Female/Other)
- Date of Birth (date picker, mm/dd/yyyy format)
- Location (text)
- Zone (dropdown: Federal Capital Territory, North-Central, North-East, North-West, South-East, South-South, South-West)
- **Camera Capture**: "Open Camera" button opens modal with live preview. "Acquire Picture" captures and shows thumbnail. Save to `photos/{uuid}.jpg`.

**Section 2: Employment & Service Records**
- Salary Structure (text)
- MDA Name (text with autocomplete from existing MDA names)
- Grade, Step (text)
- 1st Appointment, Last Promotion, Retirement Date (date pickers)
- Years of Service, Months (auto-calculate from dates OR manual override)

**Section 3: Financial & Payment Information**
- APA (₦ currency input)
- Gratuity (₦) → **Auto-triggers**: 10% Gratuity display updates instantly
- Pension (₦) → **Auto-triggers**: 10% Pension display updates instantly
- Repatriation (₦)
- Total Employee Contribution Due (₦)
- Amount Paid by OAGF (₦)
- **Read-only Calculated Displays** (green text, bold):
  - 10% Gratuity: ₦0.00
  - 10% Pension: ₦0.00
  - Amount Owed: ₦0.00
  - Due for Payment by OAGF: ₦0.00

**Section 4: Banking Information**
- Bank Name (dropdown: Access Bank, GTBank, First Bank, UBA, Zenith Bank, Union Bank, FCMB, Fidelity, Stanbic, Sterling, etc. + "Other")
- Account Number (numeric, 10 digits)
- Sort Code (text)
- Bank Address (textarea)

**Section 5: Next of Kin & Verification**
- NOK Name, NOK Phone, Relation (text)
- NOK Payment (checkbox: "Payment should go to Next of Kin")
- **Submit Record** button (green, large, bottom center)
- On submit: Validate all required fields → Save to DB → Show success toast → Clear form or redirect to Unverified list.

### 6.3 Unverified Pensioners List
- Data table with columns: Employee Name | APA | Gratuity | Pension | 10% Grat. | 10% Pens. | Status | Action
- Status badge: Yellow "Unverified"
- Actions: **Verify** (green button) → moves to Verified | **Edit** (opens form pre-filled) | **Delete** (red button, admin/clerk who created only, with confirmation modal)
- Search: Real-time filter by name
- Pagination: 10/25/50/100 entries per page
- **Export Unverified to CSV** button (top left)

### 6.4 Verified Pensioners Master List
- Same table structure but Status badge: Green "Verified"
- Read-only for clerks. Verifiers can add notes.
- **Export ALL Verified to Excel** button (green, prominent)
- Search and pagination identical.
- **No Delete** action (only admin can delete from Verified list via Admin panel)

### 6.5 Admin Dashboard (Admin-only Access)
Accessible only to users with `role = 'admin'`. Unauthorized access attempts logged and redirected.

**Admin View 1: System Overview (Interactive Cards)**
- Total Pensioners (big number card)
- Unverified Count (amber card)
- Verified Count (green card)
- Total Liability: Sum of all `due_for_payment_by_oagf` (red card, ₦ formatted)
- Total Amount Paid by OAGF (blue card)
- Charts (optional): Monthly submission trend bar chart, Status distribution pie chart.

**Admin View 2: User Management**
- Table of all staff: Name | Username | Role | Status | Last Login | Actions
- Actions: Edit Role, Deactivate/Activate, Reset Password, Delete
- **Add New User** modal: Full name, username, role dropdown, temporary password (auto-generated, shown once, must change on first login).
- Admin cannot delete their own account (safety lock).

**Admin View 3: Audit Log Viewer**
- Filterable table: Date Range | User | Action | Table | Record ID | Details
- Details column shows expandable JSON diff (old vs new values).
- **Export Audit Log to CSV** button.
- Pagination and search.

**Admin View 4: Data Export Center**
- **Export All Records to CSV**: Full table, all columns, with datestamp filename: `oagf_pension_all_20260711_143022.csv`
- **Export Verified Only**
- **Export Unverified Only**
- **Export by Date Range**: Date pickers for `created_at` range
- **Export by MDA**: Dropdown filter
- **Export by Zone**: Dropdown filter
- All exports must trigger audit log entry.
- Save dialog opens to let user choose destination folder (default: `Documents/OAGF_Exports/`).

**Admin View 5: Database Management**
- **Backup Database**: One-click create `.backup` file of PostgreSQL (using `pg_dump` logic or file copy if embedded).
- **Restore Database**: Select backup file, confirm overwrite, with safety warnings.
- **Compact/Vacuum**: Run `VACUUM ANALYZE` to optimize.
- Storage info: DB size, photo folder size, total records.

---

## 7. Auto-Calculation Logic

The frontend must show real-time updates as the user types. The backend uses PostgreSQL generated columns for data integrity.

### Frontend Real-time (JavaScript/React)
```typescript
function calculateFinancials(inputs: FinancialInputs): FinancialOutputs {
  const gratuity = parseFloat(inputs.gratuity) || 0;
  const pension = parseFloat(inputs.pension) || 0;
  const repatriation = parseFloat(inputs.repatriation) || 0;
  const apa = parseFloat(inputs.apa) || 0;
  const contribution = parseFloat(inputs.total_employee_contribution_due) || 0;
  const paid = parseFloat(inputs.amount_paid_by_oagf) || 0;

  const tenPctGratuity = gratuity * 0.10;
  const tenPctPension = pension * 0.10;
  const totalDue = gratuity + pension + repatriation + apa + contribution;
  const amountOwed = totalDue - paid; // Adjust if formula differs

  return {
    tenPercentGratuity: formatNaira(tenPctGratuity),
    tenPercentPension: formatNaira(tenPctPension),
    amountOwed: formatNaira(amountOwed),
    dueForPayment: formatNaira(amountOwed) // Adjust per business rules
  };
}

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

### Backend Validation (Rust)
Before insert/update, Rust must validate:
- Gratuity, Pension, APA, Repatriation ≥ 0
- Amount Paid by OAGF ≤ Total Due (warning if exceeds)
- Account Number is exactly 10 digits (Nigerian NUBAN standard)
- Dates are logical (Retirement > First Appointment)

---

## 8. File System & Local Storage Structure

After installation on Windows:
```
%LOCALAPPDATA%/
└── OAGF_Pension/
    ├── config/
    │   └── app_settings.json           -- App configuration, encryption keys
    ├── pg_data/                        -- Embedded PostgreSQL data files
    │   ├── base/
    │   ├── global/
    │   └── postgresql.conf
    ├── photos/
    │   ├── a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
    │   └── b2c3d4e5-f6g7-8901-bcde-fg2345678901.jpg
    ├── exports/
    │   ├── oagf_pension_all_20260711_143022.csv
    │   ├── oagf_verified_20260711_150145.xlsx
    │   └── audit_log_20260711_120000.csv
    └── backups/
        └── auto_backup_20260711_000000.sql
```

**Notes:**
- PostgreSQL must auto-start when app launches and shut down gracefully on exit.
- If `pg_data` is missing, initialize a fresh database and run migrations automatically.
- Photos must be referenced by UUID in DB, not filename, to prevent broken links on rename.

---

## 9. Tauri Commands API (Rust IPC)

Implement the following commands with full RBAC checks:

| Command | Role | Description |
|---------|------|-------------|
| `login(credentials)` | Public | Argon2id verify, create session, return token + role |
| `logout(token)` | Any | Invalidate session server-side |
| `get_current_user(token)` | Any | Return user profile |
| `create_pensioner(data, token)` | Clerk, Admin | Insert record, log audit |
| `update_pensioner(id, data, token)` | Clerk (own), Admin | Update record, log audit with diff |
| `get_pensioner(id, token)` | Any | Fetch single record |
| `list_pensioners(filter, pagination, token)` | Any | Paginated list with search |
| `verify_pensioner(id, notes, token)` | Verifier, Admin | Set status=Verified, log audit |
| `reject_pensioner(id, notes, token)` | Verifier, Admin | Set status=Rejected |
| `delete_pensioner(id, token)` | Admin | Hard delete with audit log |
| `export_csv(filter, path, token)` | Admin | Generate CSV, prevent formula injection |
| `export_excel(filter, path, token)` | Admin | Generate Excel |
| `create_user(data, token)` | Admin | Add staff, generate temp password |
| `update_user(id, data, token)` | Admin | Modify role/status |
| `reset_password(id, token)` | Admin | Generate new temp password |
| `list_users(token)` | Admin | Staff directory |
| `list_audit_logs(filter, pagination, token)` | Admin | View system audit |
| `get_dashboard_stats(token)` | Admin | Aggregated counts and sums |
| `backup_database(path, token)` | Admin | Create PG backup |
| `capture_photo() -> Vec<u8>` | Any | Return webcam frame bytes |
| `save_photo(bytes, filename) -> path` | Any | Save to photos/ folder |

---

## 10. CSV Export Specification

All CSV exports must follow this format for security and usability:

1. **UTF-8 BOM** (`﻿`) at start for Excel compatibility.
2. **Headers**: Snake_case or Title Case — consistent.
3. **Formula Injection Prevention**: Prefix any cell starting with `=`, `+`, `-`, `@`, `	`, `` with a single quote `'`. 
4. **Date Format**: ISO 8601 (`YYYY-MM-DD`) or `dd/mm/yyyy` — specify clearly.
5. **Currency**: Raw numbers (no ₦ symbol, no commas) in CSV for data processing; formatted versions only in Excel exports.
6. **Filename Convention**: `oagf_{scope}_{YYYYMMDD}_{HHMMSS}.csv`
   - scope: `all`, `verified`, `unverified`, `audit`, `mda_{name}`

---

## 11. Error Handling & User Feedback

- **Success**: Green toast notification (top-right, auto-dismiss 3s)
- **Warning**: Amber toast (validation issues, e.g., "Amount paid exceeds total due")
- **Error**: Red toast (system errors, permission denied)
- **Loading**: Spinner on submit buttons, disabled state during DB operations
- **Offline Resilience**: If PostgreSQL fails to start, show error dialog with "Retry" and "Restore Backup" options.

---

## 12. Deliverables

1. **Source Code**: Full Tauri v2 + React project in a Git repository.
2. **Windows Installer**: `.msi` file built via Tauri bundler.
3. **Database Migrations**: SQLx migration files (`migrations/001_initial.sql`, etc.).
4. **User Manual**: PDF guide for OAGF staff (installation, login, data entry, export).
5. **Admin Setup Guide**: How to create first admin, backup/restore, user management.
6. **Default Admin Credentials**: Generated on first install, displayed once, must be changed.

---

## 13. Constraints & Assumptions

- **Single-machine deployment**: Each PC runs its own embedded PostgreSQL. No multi-PC sync required (Phase 1).
- **Windows 10/11**: Primary target OS.
- **No internet**: App must function 100% offline.
- **Photo resolution**: 640x480 minimum for identification, JPEG compression 80%.
- **Data retention**: Indefinite local storage. Admin responsible for backups.
- **Concurrent users**: Single Windows user session at a time. App locks to one instance per machine.

---

*Document Version: 1.0*
*Target: OAGF Pension Severance Desktop Application v3.0*
*Style: Federal Government of Nigeria / OAGF Brand Identity*
*Security Level: Internal Administrative (Sensitive Financial Data)*
