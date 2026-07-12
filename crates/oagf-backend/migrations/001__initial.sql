-- 4.1 Users Table (Staff Authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'verifier', 'clerk')),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    must_change_password BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.2 Audit Logs Table (Immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    user_name TEXT,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    session_id UUID,
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(table_name, record_id);

-- 4.3 Pensioners Table (Core Data)
CREATE TABLE IF NOT EXISTS pensioners (
    id UUID PRIMARY KEY,

    -- 1. PERSONAL INFORMATION
    full_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth DATE,
    location TEXT,
    zone TEXT,
    photo_path TEXT,

    -- 2. EMPLOYMENT & SERVICE RECORDS
    salary_structure TEXT,
    mda_name TEXT,
    grade TEXT,
    step TEXT,
    first_appointment_date DATE,
    last_promotion_date DATE,
    retirement_date DATE,
    years_of_service INTEGER,
    months_of_service INTEGER,

    -- 3. FINANCIAL & PAYMENT INFORMATION (Inputs)
    apa NUMERIC(15,2) DEFAULT 0.00,
    gratuity NUMERIC(15,2) DEFAULT 0.00,
    pension NUMERIC(15,2) DEFAULT 0.00,
    repatriation NUMERIC(15,2) DEFAULT 0.00,
    total_employee_contribution_due NUMERIC(15,2) DEFAULT 0.00,
    amount_owed NUMERIC(15,2) DEFAULT 0.00,
    amount_owed_to_mda NUMERIC(15,2) DEFAULT 0.00,
    amount_paid_by_oagf NUMERIC(15,2) DEFAULT 0.00,

    -- Calculated Fields (maintained by application code)
    ten_percent_gratuity NUMERIC(15,2) DEFAULT 0.00,
    ten_percent_pension NUMERIC(15,2) DEFAULT 0.00,
    due_for_payment_by_oagf NUMERIC(15,2) DEFAULT 0.00,

    -- 4. BANKING INFORMATION
    bank_name TEXT,
    account_number TEXT,
    sort_code TEXT,
    bank_address TEXT,

    -- 5. NEXT OF KIN & VERIFICATION
    nok_name TEXT,
    nok_phone TEXT,
    nok_relation TEXT,
    nok_payment BOOLEAN DEFAULT FALSE,

    -- WORKFLOW & METADATA
    status TEXT DEFAULT 'Unverified' CHECK (status IN ('Unverified', 'Verified', 'Rejected')),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,

    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pensioners_status ON pensioners(status);
CREATE INDEX IF NOT EXISTS idx_pensioners_name ON pensioners(full_name);
CREATE INDEX IF NOT EXISTS idx_pensioners_mda ON pensioners(mda_name);
CREATE INDEX IF NOT EXISTS idx_pensioners_created ON pensioners(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pensioners_zone ON pensioners(zone);

-- 4.4 Sessions Table (Server-side session tracking)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, expires_at DESC);
