import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
            {props.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-md border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-oagf-green focus:outline-none focus:ring-1 focus:ring-oagf-green",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-oagf-danger">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-oagf-grey">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
