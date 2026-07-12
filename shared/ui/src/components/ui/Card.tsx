import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}

export function Card({ children, className, accent = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white shadow-sm",
        accent && "border-t-4 border-t-oagf-green",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn("border-b border-gray-100 px-6 py-5", className)}>{children}</div>;
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return <h3 className={cn("text-lg font-bold text-gray-800", className)}>{children}</h3>;
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("p-6", className)}>{children}</div>;
}
