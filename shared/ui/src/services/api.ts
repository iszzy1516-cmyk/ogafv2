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
import { tauriInvoke } from "./tauri.js";

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Mock mode is opt-in only via VITE_USE_MOCK_TAURI=true. In production the app
// always runs inside Tauri and talks to the real Rust backend / SQLite database.
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK_TAURI === "true";
const USE_MOCK = FORCE_MOCK;

function ensureRuntime(): void {
  if (USE_MOCK) return;
  if (!isTauri()) {
    throw new Error(
      "This application must run inside the Tauri desktop shell to access the local backend. " +
        "Use `npm run tauri:main` or `npm run tauri:admin`. " +
        "For browser-only UI development, start with VITE_USE_MOCK_TAURI=true.",
    );
  }
}

// Fallback mock is retained only for isolated UI development. Set
// VITE_USE_MOCK_TAURI=true to use it; production builds always use the real backend.
let mock: typeof import("./tauriMock.js") | null = null;
async function getMock() {
  if (!mock) {
    mock = await import("./tauriMock.js");
  }
  return mock;
}

export async function waitForBackend(): Promise<boolean> {
  ensureRuntime();
  if (USE_MOCK) return true;

  return new Promise<boolean>((resolve, reject) => {
    // Must stay above the Rust backend's own ready_timeout (150s) — first
    // launch can take a while to extract the bundled PostgreSQL archive,
    // run initdb, and start the server, especially with AV scanning new
    // binaries. A shorter timeout here would show a false "failed to start"
    // error while the backend is still legitimately initializing.
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for the backend to respond. Check the Rust/Tauri process and terminal logs."));
    }, 160000);

    tauriInvoke<boolean>("wait_for_backend")
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).login(credentials);
  return tauriInvoke<AuthSession>("login", { credentials });
}

export async function logout(token: string): Promise<void> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).logout(token);
  return tauriInvoke("logout", { token });
}

export async function getCurrentUser(token: string): Promise<User> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).getCurrentUser(token);
  return tauriInvoke<User>("get_current_user", { token });
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  ensureRuntime();
  if (USE_MOCK) {
    return (await getMock()).changePassword(token, currentPassword, newPassword);
  }
  return tauriInvoke("change_password", {
    token,
    request: { current_password: currentPassword, new_password: newPassword },
  });
}

export async function listPensioners(
  token: string,
  filter: ListFilter,
  pagination: PaginationParams,
): Promise<PaginatedResponse<Pensioner>> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).listPensioners(token, filter, pagination);
  return tauriInvoke<PaginatedResponse<Pensioner>>("list_pensioners", { token, filter, pagination });
}

export async function getPensioner(token: string, id: string): Promise<Pensioner> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).getPensioner(token, id);
  return tauriInvoke<Pensioner>("get_pensioner", { token, id });
}

export async function createPensioner(
  token: string,
  data: Omit<Pensioner, "id" | "created_at" | "updated_at">,
): Promise<Pensioner> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).createPensioner(token, data);
  return tauriInvoke<Pensioner>("create_pensioner", { token, data });
}

export async function updatePensioner(token: string, id: string, data: Partial<Pensioner>): Promise<Pensioner> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).updatePensioner(token, id, data);
  return tauriInvoke<Pensioner>("update_pensioner", { token, id, data });
}

export async function verifyPensioner(token: string, id: string, notes?: string): Promise<Pensioner> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).verifyPensioner(token, id, notes);
  return tauriInvoke<Pensioner>("verify_pensioner", { token, id, notes });
}

export async function rejectPensioner(token: string, id: string, notes?: string): Promise<Pensioner> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).rejectPensioner(token, id, notes);
  return tauriInvoke<Pensioner>("reject_pensioner", { token, id, notes });
}

export async function deletePensioner(token: string, id: string): Promise<void> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).deletePensioner(token, id);
  return tauriInvoke("delete_pensioner", { token, id });
}

export async function listUsers(token: string): Promise<User[]> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).listUsers(token);
  return tauriInvoke<User[]>("list_users", { token });
}

export async function createUser(
  token: string,
  data: CreateUserRequest,
): Promise<{ user: User; temp_password: string }> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).createUser(token, data);
  return tauriInvoke<{ user: User; temp_password: string }>("create_user", { token, data });
}

export async function updateUser(token: string, id: string, data: UpdateUserRequest): Promise<User> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).updateUser(token, id, data);
  return tauriInvoke<User>("update_user", { token, id, data });
}

export async function deleteUser(token: string, id: string): Promise<void> {
  ensureRuntime();
  if (USE_MOCK) {
    throw new Error("Delete user is not supported in mock mode");
  }
  return tauriInvoke("delete_user", { token, id });
}

export async function resetPassword(token: string, id: string): Promise<{ temp_password: string }> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).resetPassword(token, id);
  return tauriInvoke<{ temp_password: string }>("reset_password", { token, id });
}

export async function listAuditLogs(
  token: string,
  filter: { action?: string; user_id?: string; date_from?: string; date_to?: string },
  pagination: PaginationParams,
): Promise<PaginatedResponse<AuditLog>> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).listAuditLogs(token, filter, pagination);
  return tauriInvoke<PaginatedResponse<AuditLog>>("list_audit_logs", { token, filter, pagination });
}

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).getDashboardStats(token);
  return tauriInvoke<DashboardStats>("get_dashboard_stats", { token });
}

export async function exportCsv(
  token: string,
  filter: ExportFilter,
  path: string,
): Promise<{ filename: string; record_count: number; path: string }> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).exportCsv(token, filter, path);
  return tauriInvoke<{ filename: string; record_count: number; path: string }>("export_csv", { token, filter, path });
}

export async function exportExcel(
  token: string,
  filter: ExportFilter,
  path: string,
): Promise<{ filename: string; record_count: number; path: string }> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).exportExcel(token, filter, path);
  return tauriInvoke<{ filename: string; record_count: number; path: string }>("export_excel", { token, filter, path });
}

export async function backupDatabase(token: string, path: string): Promise<{ filename: string }> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).backupDatabase(token, path);
  return tauriInvoke<{ filename: string }>("backup_database", { token, path });
}

export async function vacuumDatabase(token: string): Promise<void> {
  ensureRuntime();
  if (USE_MOCK) return Promise.resolve();
  return tauriInvoke("vacuum_database", { token });
}

export async function storageInfo(token: string): Promise<{
  db_size: number;
  photo_folder_size: number;
  total_records: number;
}> {
  ensureRuntime();
  if (USE_MOCK) {
    return { db_size: 0, photo_folder_size: 0, total_records: 0 };
  }
  return tauriInvoke("storage_info", { token });
}

export async function listCameras(): Promise<CameraDescriptor[]> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).listCameras();
  return tauriInvoke<CameraDescriptor[]>("list_cameras");
}

export async function capturePhoto(index?: number): Promise<CaptureResult> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).capturePhoto(index);
  return tauriInvoke<CaptureResult>("capture_photo", { index });
}

export async function savePhoto(bytes: Uint8Array, filename: string): Promise<{ path: string }> {
  ensureRuntime();
  if (USE_MOCK) return (await getMock()).savePhoto(bytes, filename);
  return tauriInvoke<{ path: string }>("save_photo", { bytes, filename });
}

export async function getPhotosDir(token: string): Promise<string> {
  ensureRuntime();
  if (USE_MOCK) return Promise.resolve("photos");
  return tauriInvoke<string>("get_photos_dir", { token });
}
