import { useState } from "react";
import { useAuthStore, Button, Input, Modal } from "@oagf/ui";

export function SessionLockOverlay() {
  const { isLocked, user, unlockSession, logout, error, clearError } = useAuthStore();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setIsLoading(true);
    const ok = await unlockSession(password);
    setIsLoading(false);
    if (ok) setPassword("");
  }

  return (
    <Modal isOpen={isLocked} title="Session Locked" hideClose className="max-w-md">
      <p className="mb-4 text-sm text-oagf-grey">
        Your admin session was locked due to inactivity. Re-enter your password to continue.
      </p>
      <form onSubmit={handleUnlock} className="space-y-4">
        <Input
          label="User"
          value={user?.full_name ?? ""}
          disabled
          className="bg-gray-50"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          error={error ?? undefined}
        />
        <div className="flex gap-3">
          <Button type="submit" isLoading={isLoading} className="flex-1">
            Unlock
          </Button>
          <Button type="button" variant="outline" onClick={() => logout()}>
            Logout
          </Button>
        </div>
      </form>
    </Modal>
  );
}
