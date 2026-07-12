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
      if (user?.role !== "admin") {
        setPortalError("Invalid username or password.");
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
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <img
            src={coatOfArms}
            alt="Coat of Arms of Nigeria"
            className="mx-auto mb-4 h-24 w-auto"
          />
          <h1 className="text-2xl font-bold text-oagf-text">{APP_NAME}</h1>
          <p className="text-sm font-semibold text-oagf-green">Administrator Portal</p>
          <p className="text-xs text-oagf-grey">Federal Government of Nigeria</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
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
            <div className="rounded-lg bg-oagf-danger-light p-3 text-sm text-oagf-danger">
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
