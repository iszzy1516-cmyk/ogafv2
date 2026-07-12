import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api, ChangePasswordPage, LoadingScreen, useAuthStore } from "@oagf/ui";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { UnverifiedPage } from "./pages/UnverifiedPage";
import { VerifiedPage } from "./pages/VerifiedPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function RequirePasswordChange({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (!user.must_change_password) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RedirectByRole() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "clerk") return <Navigate to="/evaluation" replace />;
  return <Navigate to="/unverified" replace />;
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
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<RedirectByRole />} />
          <Route path="/evaluation/:id?" element={<EvaluationPage />} />
          <Route path="/unverified" element={<UnverifiedPage />} />
          <Route path="/verified" element={<VerifiedPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
