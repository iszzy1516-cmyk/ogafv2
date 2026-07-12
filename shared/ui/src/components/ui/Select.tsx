import { forwardRef, SelectHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
            {props.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "w-full rounded-md border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 shadow-sm focus:border-oagf-green focus:outline-none focus:ring-1 focus:ring-oagf-green",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled={props.required}>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-oagf-danger">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";
