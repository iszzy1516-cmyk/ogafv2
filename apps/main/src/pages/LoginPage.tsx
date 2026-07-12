import { useState } from "react";
import { Eye, EyeOff, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APP_NAME, Button, Input, coatOfArms, useAuthStore } from "@oagf/ui";

export function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setPortalError(null);
    const success = await login(username, password);
    if (success) {
      const user = useAuthStore.getState().user;
      if (user?.role === "admin") {
        setPortalError("Admin users must log in via the Admin application.");
        return;
      }
      if (user?.must_change_password) {
        navigate("/change-password", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-oagf-offwhite p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <img
            src={coatOfArms}
            alt="Coat of Arms of Nigeria"
            className="mx-auto mb-5 h-28 w-auto"
          />
          <h1 className="text-2xl font-bold text-oagf-text">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-oagf-grey">Federal Government of Nigeria</p>
          <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-oagf-green" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
            />
            <User className="pointer-events-none absolute right-3 top-[34px] text-oagf-grey" size={18} />
          </div>

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-oagf-grey hover:text-oagf-text"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {(error || portalError) && (
            <div className="rounded-lg border border-red-200 bg-oagf-danger-light p-3 text-sm text-oagf-danger">
              {portalError || error}
            </div>
          )}

          <Button type="submit" size="lg" isLoading={isLoading} className="w-full">
            Sign In
          </Button>

          {isLoading && (
            <p className="text-center text-xs text-oagf-grey">
              Authenticating, please wait...
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
