import { Link, useLocation } from "react-router-dom";
import { APP_NAME, cn, coatOfArms } from "@oagf/ui";
import type { Role } from "@oagf/ui";

interface NavItem {
  label: string;
  path: string;
  roles: Role[];
}

const navItems: NavItem[] = [
  { label: "Evaluation", path: "/evaluation", roles: ["admin", "verifier", "clerk"] },
  { label: "Unverified", path: "/unverified", roles: ["admin", "verifier", "clerk"] },
  { label: "Verified List", path: "/verified", roles: ["admin", "verifier", "clerk"] },
];

interface TopNavProps {
  role: Role;
  onLogout: () => void;
}

export function TopNav({ role, onLogout }: TopNavProps) {
  const location = useLocation();
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <header className="bg-oagf-green text-white shadow-md">
      <div className="grid h-[4.5rem] grid-cols-[1fr_auto_1fr] items-center px-6">
        <div className="flex items-center gap-3.5">
          <img
            src={coatOfArms}
            alt="Coat of Arms of Nigeria"
            className="h-11 w-auto rounded-full bg-white p-0.5 shadow-sm"
          />
          <div>
            <h1 className="text-lg font-bold leading-tight">{APP_NAME}</h1>
            <p className="text-xs text-green-100">Federal Government of Nigeria</p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {visibleItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/90 hover:bg-white/10 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex justify-end">
          <button
            onClick={onLogout}
            className="rounded-md border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
