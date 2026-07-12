import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APP_NAME, Button, Input, coatOfArms, useAuthStore, useUIStore } from "../../index.js";

interface ChangePasswordPageProps {
  title?: string;
  redirectPath?: string;
}

export function ChangePasswordPage({ title = "Change Password", redirectPath = "/" }: ChangePasswordPageProps) {
  const { changePassword, isLoading, error, clearError } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setValidationError(null);

    if (newPassword !== confirmPassword) {
      setValidationError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setValidationError("Password must contain an uppercase letter");
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setValidationError("Password must contain a lowercase letter");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setValidationError("Password must contain a number");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setValidationError("Password must contain a special character");
      return;
    }

    const success = await changePassword(currentPassword, newPassword);
    if (success) {
      addToast({ type: "success", title: "Password Updated", message: "Your password has been changed successfully." });
      navigate(redirectPath, { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-oagf-offwhite p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <img src={coatOfArms} alt="Coat of Arms of Nigeria" className="mx-auto mb-5 h-28 w-auto" />
          <h1 className="text-2xl font-bold text-oagf-text">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-oagf-grey">Federal Government of Nigeria</p>
          <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-oagf-green" />
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <ShieldCheck size={22} />
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm">
              You must change your password before continuing.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Input
              label="Current Password"
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-[34px] text-oagf-grey hover:text-oagf-text"
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="New Password"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-[34px] text-oagf-grey hover:text-oagf-text"
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Confirm New Password"
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-[34px] text-oagf-grey hover:text-oagf-text"
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <p className="text-xs text-oagf-grey">
            Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
          </p>

          {(validationError || error) && (
            <div className="rounded-lg border border-red-200 bg-oagf-danger-light p-3 text-sm text-oagf-danger">
              {validationError || error}
            </div>
          )}

          <Button type="submit" size="lg" isLoading={isLoading} className="w-full">
            Change Password
          </Button>
        </form>
      </div>
    </div>
  );
}
