import { cn } from "../../utils/cn";

type BadgeVariant = "unverified" | "verified" | "rejected" | "default" | "amber" | "green" | "red" | "blue";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const styles: Record<BadgeVariant, string> = {
  unverified: "bg-amber-100 text-amber-800",
  verified: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  default: "bg-gray-100 text-gray-800",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
};

const dotStyles: Record<BadgeVariant, string> = {
  unverified: "bg-amber-500",
  verified: "bg-green-500",
  rejected: "bg-red-500",
  default: "bg-gray-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
        styles[variant],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotStyles[variant])} />
      {children}
    </span>
  );
}
