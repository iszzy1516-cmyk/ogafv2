export const ROLES = ["admin", "verifier", "clerk"] as const;

export const GENDERS = ["Male", "Female", "Other"] as const;

export const PENSIONER_STATUSES = ["Unverified", "Verified", "Rejected"] as const;

export const ZONES = [
  "Federal Capital Territory",
  "North-Central",
  "North-East",
  "North-West",
  "South-East",
  "South-South",
  "South-West",
] as const;

export const BANKS = [
  "Access Bank",
  "GTBank",
  "First Bank",
  "UBA",
  "Zenith Bank",
  "Union Bank",
  "FCMB",
  "Fidelity",
  "Stanbic",
  "Sterling",
  "Other",
] as const;

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 10;

// 15 minutes in milliseconds
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

// Audit log actions
export const AUDIT_ACTIONS = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  VERIFY: "VERIFY",
  REJECT: "REJECT",
  DELETE: "DELETE",
  EXPORT_CSV: "EXPORT_CSV",
  EXPORT_EXCEL: "EXPORT_EXCEL",
  BACKUP: "BACKUP",
  RESTORE: "RESTORE",
} as const;

export const APP_NAME = "OAGF Pension Severance";
