import { cn } from "../../utils/cn";

interface SectionHeaderProps {
  number?: number;
  title: string;
  className?: string;
}

export function SectionHeader({ number, title, className }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex items-center gap-3 border-b border-gray-100 pb-4",
        className,
      )}
    >
      {number && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oagf-green text-sm font-bold text-white shadow-sm">
          {number}
        </span>
      )}
      <h3 className="text-lg font-bold text-gray-800">{title}</h3>
    </div>
  );
}
