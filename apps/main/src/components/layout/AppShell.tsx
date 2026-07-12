import { Outlet } from "react-router-dom";
import { useAuthStore, useSessionTimeout, ToastContainer } from "@oagf/ui";
import { TopNav } from "./TopNav";
import { SessionLockOverlay } from "./SessionLockOverlay";

export function AppShell() {
  const { user, logout } = useAuthStore();
  useSessionTimeout();

  return (
    <div className="flex min-h-screen flex-col bg-oagf-offwhite">
      <TopNav role={user!.role} onLogout={() => logout()} />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <Outlet />
      </main>
      <SessionLockOverlay />
      <ToastContainer />
    </div>
  );
}
