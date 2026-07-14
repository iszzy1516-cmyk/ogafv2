import type {
  AuditLog,
  AuthSession,
  CameraDescriptor,
  CaptureResult,
  CreateUserRequest,
  DashboardStats,
  ExportFilter,
  ListFilter,
  LoginCredentials,
  PaginationParams,
  Pensioner,
  UpdateUserRequest,
  User,
  PaginatedResponse,
} from "../types";
import { AUDIT_ACTIONS } from "../utils/constants";
import { generateTimestampFilename } from "../utils/formatters";
import { tauriInvoke } from "./tauri.js";

// ---------------------------------------------------------------------------
// In-memory seed data
// ---------------------------------------------------------------------------

const MOCK_PASSWORDS: Record<string, string> = {
  admin: "Admin@123",
  clerk: "Clerk@123",
};

let users: User[] = [
  {
    id: "u-001",
    username: "admin",
    role: "admin",
    full_name: "System Administrator",
    email: "admin@oagf.gov.ng",
    phone: "08012345678",
    is_active: true,
    last_login: new Date().toISOString(),
    password_changed_at: undefined,
    must_change_password: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "u-003",
    username: "clerk",
    role: "clerk",
    full_name: "Chinedu Okafor",
    email: "clerk@oagf.gov.ng",
    phone: "08034567890",
    is_active: true,
    last_login: new Date().toISOString(),
    password_changed_at: undefined,
    must_change_password: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let pensioners: Pensioner[] = [
  createMockPensioner({
    id: "p-001",
    full_name: "Ibrahim Abdullahi",
    gender: "Male",
    location: "Abuja",
    zone: "Federal Capital Territory",
    mda_name: "Ministry of Finance",
    status: "Unverified",
    apa: 0,
    gratuity: 2500000,
    pension: 1800000,
    repatriation: 500000,
    total_employee_contribution_due: 300000,
    amount_paid_by_oagf: 0,
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-002",
    full_name: "Ngozi Eze",
    gender: "Female",
    location: "Lagos",
    zone: "South-West",
    mda_name: "Federal Ministry of Education",
    status: "Verified",
    apa: 0,
    gratuity: 3200000,
    pension: 2400000,
    repatriation: 600000,
    total_employee_contribution_due: 450000,
    amount_paid_by_oagf: 500000,
    verified_by: "u-002",
    verified_at: new Date().toISOString(),
    verification_notes: "All documents verified.",
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-003",
    full_name: "Yusuf Garba",
    gender: "Male",
    location: "Kano",
    zone: "North-West",
    mda_name: "Ministry of Finance",
    status: "Rejected",
    apa: 0,
    gratuity: 1500000,
    pension: 900000,
    repatriation: 300000,
    total_employee_contribution_due: 150000,
    amount_paid_by_oagf: 0,
    verified_by: "u-002",
    verified_at: new Date().toISOString(),
    verification_notes: "Incomplete records.",
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-004",
    full_name: "A E",
    gender: "Male",
    location: "Lagos",
    zone: "South-West",
    mda_name: "Ministry of Finance",
    status: "Unverified",
    apa: 0,
    gratuity: 512718.96,
    pension: 144613.04,
    repatriation: 100000,
    total_employee_contribution_due: 50000,
    amount_paid_by_oagf: 0,
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-005",
    full_name: "A Olayeni",
    gender: "Female",
    location: "Ibadan",
    zone: "South-West",
    mda_name: "Federal Ministry of Education",
    status: "Unverified",
    apa: 0,
    gratuity: 435291.9,
    pension: 118368.85,
    repatriation: 80000,
    total_employee_contribution_due: 40000,
    amount_paid_by_oagf: 0,
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-006",
    full_name: "Aba Audu",
    gender: "Male",
    location: "Kaduna",
    zone: "North-West",
    mda_name: "Ministry of Finance",
    status: "Unverified",
    apa: 0,
    gratuity: 218714.8,
    pension: 63497.84,
    repatriation: 50000,
    total_employee_contribution_due: 25000,
    amount_paid_by_oagf: 0,
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-007",
    full_name: "Abah P E",
    gender: "Male",
    location: "Abuja",
    zone: "Federal Capital Territory",
    mda_name: "Ministry of Finance",
    status: "Unverified",
    apa: 0,
    gratuity: 191344.44,
    pension: 0,
    repatriation: 40000,
    total_employee_contribution_due: 20000,
    amount_paid_by_oagf: 0,
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-008",
    full_name: "Abbey V B",
    gender: "Female",
    location: "Benin",
    zone: "South-South",
    mda_name: "Federal Ministry of Education",
    status: "Unverified",
    apa: 0,
    gratuity: 932588.8,
    pension: 254342.4,
    repatriation: 150000,
    total_employee_contribution_due: 75000,
    amount_paid_by_oagf: 0,
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-009",
    full_name: "Abdul Ameh",
    gender: "Male",
    location: "Lokoja",
    zone: "North-Central",
    mda_name: "Ministry of Finance",
    status: "Unverified",
    apa: 0,
    gratuity: 153555.9,
    pension: 46066.77,
    repatriation: 30000,
    total_employee_contribution_due: 15000,
    amount_paid_by_oagf: 0,
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-010",
    full_name: "Abdulkadir J",
    gender: "Male",
    location: "Kano",
    zone: "North-West",
    mda_name: "Ministry of Finance",
    status: "Unverified",
    apa: 0,
    gratuity: 512718.96,
    pension: 144613.04,
    repatriation: 100000,
    total_employee_contribution_due: 50000,
    amount_paid_by_oagf: 0,
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-011",
    full_name: "Abdulkadir Shidalu",
    gender: "Male",
    location: "Sokoto",
    zone: "North-West",
    mda_name: "Federal Ministry of Education",
    status: "Unverified",
    apa: 0,
    gratuity: 258908.4,
    pension: 75166.96,
    repatriation: 60000,
    total_employee_contribution_due: 30000,
    amount_paid_by_oagf: 0,
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-012",
    full_name: "Chinedu Okafor",
    gender: "Male",
    location: "Enugu",
    zone: "South-East",
    mda_name: "Ministry of Finance",
    status: "Verified",
    apa: 0,
    gratuity: 1875000,
    pension: 625000,
    repatriation: 200000,
    total_employee_contribution_due: 100000,
    amount_paid_by_oagf: 100000,
    verified_by: "u-002",
    verified_at: new Date().toISOString(),
    verification_notes: "Documents complete.",
    created_by: "u-003",
  }),
  createMockPensioner({
    id: "p-013",
    full_name: "Amina Bello",
    gender: "Female",
    location: "Kaduna",
    zone: "North-West",
    mda_name: "Federal Ministry of Education",
    status: "Verified",
    apa: 0,
    gratuity: 2100000,
    pension: 700000,
    repatriation: 250000,
    total_employee_contribution_due: 120000,
    amount_paid_by_oagf: 120000,
    verified_by: "u-002",
    verified_at: new Date().toISOString(),
    verification_notes: "Approved for payment.",
    created_by: "u-003",
  }),
];

let auditLogs: AuditLog[] = [
  {
    id: "a-001",
    user_id: "u-001",
    user_name: "System Administrator",
    action: AUDIT_ACTIONS.LOGIN,
    performed_at: new Date().toISOString(),
  },
];

const sessions: Map<string, User> = new Map();

function recalc(p: Pensioner): Pensioner {
  const tenPercentGratuity = Math.round(p.gratuity * 0.1 * 100) / 100;
  const tenPercentPension = Math.round(p.pension * 0.1 * 100) / 100;
  const dueForPayment =
    Math.round(
      (p.gratuity +
        tenPercentGratuity +
        p.pension +
        tenPercentPension +
        p.repatriation +
        p.total_employee_contribution_due -
        p.amount_owed -
        p.amount_paid_by_oagf) *
        100,
    ) / 100;
  return {
    ...p,
    ten_percent_gratuity: tenPercentGratuity,
    ten_percent_pension: tenPercentPension,
    due_for_payment_by_oagf: dueForPayment,
  };
}

function createMockPensioner(partial: Partial<Pensioner>): Pensioner {
  const now = new Date().toISOString();
  const base: Pensioner = {
    id: partial.id ?? crypto.randomUUID(),
    full_name: partial.full_name ?? "",
    gender: partial.gender,
    date_of_birth: partial.date_of_birth,
    location: partial.location,
    zone: partial.zone,
    photo_path: partial.photo_path,
    salary_structure: partial.salary_structure,
    mda_name: partial.mda_name,
    grade: partial.grade,
    step: partial.step,
    first_appointment_date: partial.first_appointment_date,
    last_promotion_date: partial.last_promotion_date,
    retirement_date: partial.retirement_date,
    years_of_service: partial.years_of_service,
    months_of_service: partial.months_of_service,
    apa: partial.apa ?? 0,
    gratuity: partial.gratuity ?? 0,
    pension: partial.pension ?? 0,
    repatriation: partial.repatriation ?? 0,
    total_employee_contribution_due: partial.total_employee_contribution_due ?? 0,
    amount_owed: partial.amount_owed ?? 0,
    amount_owed_to_mda: partial.amount_owed_to_mda ?? 0,
    amount_paid_by_oagf: partial.amount_paid_by_oagf ?? 0,
    ten_percent_gratuity: 0,
    ten_percent_pension: 0,
    due_for_payment_by_oagf: 0,
    bank_name: partial.bank_name,
    account_number: partial.account_number,
    sort_code: partial.sort_code,
    bank_address: partial.bank_address,
    nok_name: partial.nok_name,
    nok_phone: partial.nok_phone,
    nok_relation: partial.nok_relation,
    nok_payment: partial.nok_payment ?? false,
    status: partial.status ?? "Unverified",
    verified_by: partial.verified_by,
    verified_at: partial.verified_at,
    verification_notes: partial.verification_notes,
    created_by: partial.created_by,
    updated_by: partial.updated_by,
    created_at: partial.created_at ?? now,
    updated_at: partial.updated_at ?? now,
  };
  return recalc(base);
}

function requireAuth(token: string): User {
  const user = sessions.get(token);
  if (!user) throw new Error("Unauthorized");
  return user;
}

function logAudit(
  user: User,
  action: string,
  tableName?: string,
  recordId?: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
): void {
  auditLogs.unshift({
    id: `a-${Date.now()}`,
    user_id: user.id,
    user_name: user.full_name,
    action,
    table_name: tableName,
    record_id: recordId,
    old_values: oldValues,
    new_values: newValues,
    performed_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Mock API
// ---------------------------------------------------------------------------

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  await delay(400);
  const user = users.find((u) => u.username === credentials.username && u.is_active);
  if (!user || MOCK_PASSWORDS[credentials.username] !== credentials.password) {
    throw new Error("Invalid username or password");
  }
  const token = `tok-${crypto.randomUUID()}`;
  sessions.set(token, user);
  user.last_login = new Date().toISOString();
  logAudit(user, AUDIT_ACTIONS.LOGIN);
  return { token, user };
}

export async function logout(token: string): Promise<void> {
  const user = sessions.get(token);
  sessions.delete(token);
  if (user) logAudit(user, AUDIT_ACTIONS.LOGOUT);
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = requireAuth(token);
  if (MOCK_PASSWORDS[user.username] !== currentPassword) {
    throw new Error("Current password is incorrect");
  }
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  MOCK_PASSWORDS[user.username] = newPassword;
  user.must_change_password = false;
  user.password_changed_at = new Date().toISOString();
  logAudit(user, AUDIT_ACTIONS.UPDATE, "users", user.id, undefined, { password_changed: true });
}

export async function getCurrentUser(token: string): Promise<User> {
  await delay(200);
  return requireAuth(token);
}

export async function listPensioners(
  token: string,
  filter: ListFilter,
  pagination: PaginationParams,
): Promise<PaginatedResponse<Pensioner>> {
  await delay(300);
  requireAuth(token);
  let data = [...pensioners];

  if (filter.status) {
    data = data.filter((p) => p.status === filter.status);
  }
  if (filter.mda) {
    data = data.filter((p) => p.mda_name?.toLowerCase().includes(filter.mda!.toLowerCase()));
  }
  if (filter.zone) {
    data = data.filter((p) => p.zone === filter.zone);
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    data = data.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.mda_name?.toLowerCase().includes(q) ?? false) ||
        (p.location?.toLowerCase().includes(q) ?? false),
    );
  }
  if (filter.date_from) {
    const from = new Date(filter.date_from).getTime();
    data = data.filter((p) => new Date(p.created_at).getTime() >= from);
  }
  if (filter.date_to) {
    const to = new Date(filter.date_to).getTime();
    data = data.filter((p) => new Date(p.created_at).getTime() <= to);
  }

  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / pagination.per_page));
  const page = Math.min(pagination.page, totalPages);
  const start = (page - 1) * pagination.per_page;
  const paginated = data.slice(start, start + pagination.per_page);

  return { data: paginated, total, page, per_page: pagination.per_page, total_pages: totalPages };
}

export async function getPensioner(token: string, id: string): Promise<Pensioner> {
  await delay(200);
  requireAuth(token);
  const p = pensioners.find((x) => x.id === id);
  if (!p) throw new Error("Pensioner not found");
  return p;
}

export async function createPensioner(token: string, data: Omit<Pensioner, "id" | "created_at" | "updated_at">): Promise<Pensioner> {
  await delay(400);
  const user = requireAuth(token);
  if (user.role !== "admin" && user.role !== "clerk") {
    throw new Error("Permission denied");
  }
  const p = createMockPensioner({ ...data, created_by: user.id, updated_by: user.id });
  pensioners.unshift(p);
  logAudit(user, AUDIT_ACTIONS.CREATE, "pensioners", p.id, undefined, { ...p } as unknown as Record<string, unknown>);
  return p;
}

export async function updatePensioner(
  token: string,
  id: string,
  data: Partial<Pensioner>,
): Promise<Pensioner> {
  await delay(400);
  const user = requireAuth(token);
  const idx = pensioners.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Pensioner not found");
  const existing = pensioners[idx];

  if (user.role !== "admin" && !(user.role === "clerk" && existing.created_by === user.id)) {
    throw new Error("Permission denied");
  }

  const oldValues = { ...existing } as unknown as Record<string, unknown>;
  const updated = createMockPensioner({
    ...existing,
    ...data,
    id: existing.id,
    created_by: existing.created_by,
    created_at: existing.created_at,
    updated_by: user.id,
  });
  pensioners[idx] = updated;
  logAudit(user, AUDIT_ACTIONS.UPDATE, "pensioners", updated.id, oldValues, { ...updated } as unknown as Record<string, unknown>);
  return updated;
}

export async function verifyPensioner(token: string, id: string, notes?: string): Promise<Pensioner> {
  await delay(300);
  const user = requireAuth(token);
  if (user.role !== "admin" && user.role !== "clerk" && user.role !== "verifier") {
    throw new Error("Permission denied");
  }
  const p = await getPensioner(token, id);
  const updated = await updatePensioner(token, id, {
    status: "Verified",
    verified_by: user.id,
    verified_at: new Date().toISOString(),
    verification_notes: notes,
  });
  logAudit(user, AUDIT_ACTIONS.VERIFY, "pensioners", id, { status: p.status }, { status: "Verified" });
  return updated;
}

export async function rejectPensioner(token: string, id: string, notes?: string): Promise<Pensioner> {
  await delay(300);
  const user = requireAuth(token);
  if (user.role !== "admin" && user.role !== "clerk" && user.role !== "verifier") {
    throw new Error("Permission denied");
  }
  const p = await getPensioner(token, id);
  const updated = await updatePensioner(token, id, {
    status: "Rejected",
    verified_by: user.id,
    verified_at: new Date().toISOString(),
    verification_notes: notes,
  });
  logAudit(user, AUDIT_ACTIONS.REJECT, "pensioners", id, { status: p.status }, { status: "Rejected" });
  return updated;
}

export async function deletePensioner(token: string, id: string): Promise<void> {
  await delay(300);
  const user = requireAuth(token);
  if (user.role !== "admin") throw new Error("Permission denied");
  const idx = pensioners.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Pensioner not found");
  const deleted = pensioners[idx];
  pensioners.splice(idx, 1);
  logAudit(user, AUDIT_ACTIONS.DELETE, "pensioners", id, { ...deleted } as unknown as Record<string, unknown>, undefined);
}

export async function listUsers(token: string): Promise<User[]> {
  await delay(300);
  requireAuth(token);
  return [...users];
}

export async function createUser(
  token: string,
  data: CreateUserRequest,
): Promise<{ user: User; temp_password: string }> {
  await delay(400);
  const user = requireAuth(token);
  if (user.role !== "admin") throw new Error("Permission denied");
  if (users.some((u) => u.username === data.username)) {
    throw new Error("Username already exists");
  }
  const tempPassword = `Temp@${Math.floor(100000 + Math.random() * 900000)}`;
  const newUser: User = {
    id: `u-${Date.now()}`,
    username: data.username,
    role: data.role,
    full_name: data.full_name,
    is_active: true,
    must_change_password: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_PASSWORDS[data.username] = tempPassword;
  users.push(newUser);
  logAudit(user, AUDIT_ACTIONS.CREATE, "users", newUser.id, undefined, { ...newUser });
  return { user: newUser, temp_password: tempPassword };
}

export async function updateUser(
  token: string,
  id: string,
  data: UpdateUserRequest,
): Promise<User> {
  await delay(300);
  const user = requireAuth(token);
  if (user.role !== "admin") throw new Error("Permission denied");
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("User not found");
  if (id === user.id && data.is_active === false) {
    throw new Error("Cannot deactivate your own account");
  }
  const oldValues = { ...users[idx] };
  users[idx] = { ...users[idx], ...data, updated_at: new Date().toISOString() };
  logAudit(user, AUDIT_ACTIONS.UPDATE, "users", id, oldValues, { ...users[idx] });
  return users[idx];
}

export async function resetPassword(token: string, id: string): Promise<{ temp_password: string }> {
  await delay(300);
  const user = requireAuth(token);
  if (user.role !== "admin") throw new Error("Permission denied");
  const target = users.find((u) => u.id === id);
  if (!target) throw new Error("User not found");
  const tempPassword = `Reset@${Math.floor(100000 + Math.random() * 900000)}`;
  MOCK_PASSWORDS[target.username] = tempPassword;
  target.password_changed_at = new Date().toISOString();
  logAudit(user, AUDIT_ACTIONS.UPDATE, "users", id, undefined, { password_changed: true });
  return { temp_password: tempPassword };
}

export async function listAuditLogs(
  token: string,
  filter: { action?: string; user_id?: string; date_from?: string; date_to?: string },
  pagination: PaginationParams,
): Promise<PaginatedResponse<AuditLog>> {
  await delay(300);
  requireAuth(token);
  let data = [...auditLogs];
  if (filter.action) data = data.filter((a) => a.action === filter.action);
  if (filter.user_id) data = data.filter((a) => a.user_id === filter.user_id);
  if (filter.date_from) {
    const from = new Date(filter.date_from).getTime();
    data = data.filter((a) => new Date(a.performed_at).getTime() >= from);
  }
  if (filter.date_to) {
    const to = new Date(filter.date_to).getTime();
    data = data.filter((a) => new Date(a.performed_at).getTime() <= to);
  }
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / pagination.per_page));
  const page = Math.min(pagination.page, totalPages);
  const start = (page - 1) * pagination.per_page;
  return { data: data.slice(start, start + pagination.per_page), total, page, per_page: pagination.per_page, total_pages: totalPages };
}

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  await delay(300);
  requireAuth(token);
  const total = pensioners.length;
  const unverified = pensioners.filter((p) => p.status === "Unverified").length;
  const verified = pensioners.filter((p) => p.status === "Verified").length;
  const rejected = pensioners.filter((p) => p.status === "Rejected").length;
  const totalLiability = pensioners.reduce((sum, p) => sum + p.due_for_payment_by_oagf, 0);
  const totalPaid = pensioners.reduce((sum, p) => sum + p.amount_paid_by_oagf, 0);
  return {
    total_pensioners: total,
    unverified_count: unverified,
    verified_count: verified,
    rejected_count: rejected,
    total_liability: totalLiability,
    total_paid: totalPaid,
  };
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

const EXPORT_HEADERS = [
  "Full Name",
  "MDA",
  "Zone",
  "Status",
  "Gratuity",
  "Pension",
  "10% Gratuity",
  "10% Pension",
  "Repatriation",
  "Employee Contribution",
  "Amount Owed",
  "Amount Paid by OAGF",
  "Due for Payment",
];

function pensionerRow(p: Pensioner): string[] {
  return [
    p.full_name,
    p.mda_name ?? "",
    p.zone ?? "",
    p.status,
    String(p.gratuity ?? 0),
    String(p.pension ?? 0),
    String(p.ten_percent_gratuity ?? 0),
    String(p.ten_percent_pension ?? 0),
    String(p.repatriation ?? 0),
    String(p.total_employee_contribution_due ?? 0),
    String(p.amount_owed ?? 0),
    String(p.amount_paid_by_oagf ?? 0),
    String(p.due_for_payment_by_oagf ?? 0),
  ];
}

export async function exportCsv(
  token: string,
  filter: ExportFilter,
  _path: string,
): Promise<{ filename: string; record_count: number; path: string }> {
  await delay(600);
  const user = requireAuth(token);
  if (user.role !== "admin" && user.role !== "verifier" && user.role !== "clerk") {
    throw new Error("Permission denied");
  }
  if (filter.scope === "audit" && user.role !== "admin") {
    throw new Error("Permission denied");
  }

  const scope = filter.scope;
  let data: Pensioner[] = [];
  if (scope === "all") data = [...pensioners];
  else if (scope === "verified") data = pensioners.filter((p) => p.status === "Verified");
  else if (scope === "unverified") data = pensioners.filter((p) => p.status === "Unverified");
  else if (scope === "rejected") data = pensioners.filter((p) => p.status === "Rejected");

  if (scope === "audit") {
    const auditFilename = generateTimestampFilename("audit", "csv");
    const lines = [
      ["Date", "User", "Action", "Table", "Record ID"].map(csvEscape).join(","),
      ...auditLogs.map((a) => [a.performed_at, a.user_name, a.action, a.table_name ?? "", a.record_id ?? ""].map(csvEscape).join(",")),
    ];
    const path = await tauriInvoke<string>("save_csv_export", {
      filename: auditFilename,
      content: lines.join("\n"),
    });
    logAudit(user, AUDIT_ACTIONS.EXPORT_CSV, "audit_logs", undefined, undefined, { filter, record_count: auditLogs.length });
    return { filename: auditFilename, record_count: auditLogs.length, path };
  }

  const filename = generateTimestampFilename(scope, "csv");
  const lines = [
    EXPORT_HEADERS.map(csvEscape).join(","),
    ...data.map((p) => pensionerRow(p).map(csvEscape).join(",")),
  ];
  const path = await tauriInvoke<string>("save_csv_export", {
    filename,
    content: lines.join("\n"),
  });
  logAudit(user, AUDIT_ACTIONS.EXPORT_CSV, "pensioners", undefined, undefined, { filter, record_count: data.length });
  return { filename, record_count: data.length, path };
}

export async function exportExcel(
  token: string,
  filter: ExportFilter,
  _path: string,
): Promise<{ filename: string; record_count: number; path: string }> {
  await delay(600);
  const user = requireAuth(token);
  if (user.role !== "admin" && user.role !== "verifier" && user.role !== "clerk") {
    throw new Error("Permission denied");
  }

  const scope = filter.scope;
  let data: Pensioner[] = [];
  if (scope === "all") data = [...pensioners];
  else if (scope === "verified") data = pensioners.filter((p) => p.status === "Verified");
  else if (scope === "unverified") data = pensioners.filter((p) => p.status === "Unverified");
  else if (scope === "rejected") data = pensioners.filter((p) => p.status === "Rejected");

  const filename = generateTimestampFilename(scope, "xlsx");
  const rows = data.map((p) => pensionerRow(p));
  const path = await tauriInvoke<string>("write_excel_export", {
    filename,
    headers: EXPORT_HEADERS,
    rows,
  });
  logAudit(user, AUDIT_ACTIONS.EXPORT_EXCEL, "pensioners", undefined, undefined, { filter, record_count: data.length });
  return { filename, record_count: data.length, path };
}

export async function backupDatabase(token: string, _path: string): Promise<{ filename: string }> {
  await delay(800);
  const user = requireAuth(token);
  if (user.role !== "admin") throw new Error("Permission denied");
  logAudit(user, AUDIT_ACTIONS.BACKUP, "database", undefined, undefined, { timestamp: new Date().toISOString() });
  return { filename: generateTimestampFilename("backup", "sql") };
}

export async function listCameras(): Promise<CameraDescriptor[]> {
  await delay(200);
  return [];
}

export async function capturePhoto(_index?: number): Promise<CaptureResult> {
  await delay(500);
  // Return a tiny 1x1 grey JPEG as a data URL.
  const dataUrl =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPTYzNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/AHuiiigAooooAP/Z";
  return { data_url: dataUrl, width: 1, height: 1 };
}

export async function savePhoto(_bytes: Uint8Array, filename: string): Promise<{ path: string }> {
  await delay(300);
  return { path: `photos/${filename}` };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
