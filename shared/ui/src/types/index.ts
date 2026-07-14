export type Role = "admin" | "verifier" | "clerk";

export interface User {
  id: string;
  username: string;
  role: Role;
  full_name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  last_login?: string;
  password_changed_at?: string;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export type PensionerStatus = "Unverified" | "Verified" | "Rejected";

export interface Pensioner {
  id: string;

  // 1. Personal Information
  full_name: string;
  gender?: "Male" | "Female" | "Other";
  date_of_birth?: string;
  location?: string;
  zone?: string;
  photo_path?: string;

  // 2. Employment & Service Records
  salary_structure?: string;
  mda_name?: string;
  grade?: string;
  step?: string;
  first_appointment_date?: string;
  last_promotion_date?: string;
  retirement_date?: string;
  years_of_service?: number;
  months_of_service?: number;

  // 3. Financial & Payment Information
  apa: number;
  gratuity: number;
  pension: number;
  repatriation: number;
  total_employee_contribution_due: number;
  amount_owed: number;
  amount_owed_to_mda: number;
  amount_paid_by_oagf: number;

  // Auto-calculated fields
  ten_percent_gratuity: number;
  ten_percent_pension: number;
  due_for_payment_by_oagf: number;

  // 4. Banking Information
  bank_name?: string;
  account_number?: string;
  /** @deprecated Sort code is no longer collected in the UI. Kept for backward compatibility. */
  sort_code?: string;
  bank_address?: string;

  // 5. Next of Kin & Verification
  nok_name?: string;
  nok_phone?: string;
  nok_relation?: string;
  nok_payment: boolean;

  // Workflow & Metadata
  status: PensionerStatus;
  verified_by?: string;
  verified_at?: string;
  verification_notes?: string;

  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialInputs {
  apa: string;
  gratuity: string;
  pension: string;
  repatriation: string;
  total_employee_contribution_due: string;
  amount_owed: string;
  amount_paid_by_oagf: string;
}

export interface FinancialOutputs {
  tenPercentGratuity: string;
  tenPercentPension: string;
  amountOwed: string;
  dueForPayment: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  table_name?: string;
  record_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  session_id?: string;
  performed_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_active_at: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface CreateUserRequest {
  full_name: string;
  username: string;
  role: Role;
}

export interface UpdateUserRequest {
  full_name?: string;
  role?: Role;
  is_active?: boolean;
}

export interface PaginationParams {
  page: number;
  per_page: number;
}

export interface ListFilter {
  status?: PensionerStatus;
  search?: string;
  mda?: string;
  zone?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface DashboardStats {
  total_pensioners: number;
  unverified_count: number;
  verified_count: number;
  rejected_count: number;
  total_liability: number;
  total_paid: number;
}

export interface ExportFilter {
  scope: "all" | "verified" | "unverified" | "rejected" | "audit" | "mda";
  date_from?: string;
  date_to?: string;
  mda?: string;
  zone?: string;
}

export interface CameraDescriptor {
  index: number;
  name: string;
}

export interface CaptureResult {
  data_url: string;
  width: number;
  height: number;
}
