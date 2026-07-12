import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api, ChangePasswordPage, LoadingScreen, useAuthStore } from "@oagf/ui";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RecordsCollectionPage } from "./pages/RecordsCollectionPage";
import { UsersPage } from "./pages/UsersPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { ExportCenterPage } from "./pages/ExportCenterPage";
import { DatabasePage } from "./pages/DatabasePage";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  if (user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-oagf-danger-light p-6 text-oagf-danger">
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p>Administrator privileges required.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function RequirePasswordChange({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (!user.must_change_password) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function checkBackend() {
      setStartError(null);
      try {
        await api.waitForBackend();
        if (!cancelled) setBackendReady(true);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setStartError(message);
        }
      }
    }

    checkBackend();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (!backendReady) {
    return (
      <LoadingScreen
        error={startError}
        onRetry={startError ? () => setAttempt((n) => n + 1) : undefined}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/change-password"
          element={
            <RequirePasswordChange>
              <ChangePasswordPage redirectPath="/" />
            </RequirePasswordChange>
          }
        />
        <Route
          element={
            <RequireAdmin>
              <AppShell />
            </RequireAdmin>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/records" element={<RecordsCollectionPage />} />
          <Route path="/records/:id" element={<RecordsCollectionPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/audit" element={<AuditLogsPage />} />
          <Route path="/export" element={<ExportCenterPage />} />
          <Route path="/database" element={<DatabasePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
