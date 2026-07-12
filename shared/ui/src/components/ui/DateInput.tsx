import { forwardRef, useState, InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface DateInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, error, hint, className, value, onChange, ...props }, ref) => {
    const [localError, setLocalError] = useState<string | null>(null);

    function isValidDate(text: string) {
      if (!text) return true;
      if (!DATE_PATTERN.test(text)) return false;
      const d = new Date(text);
      return !Number.isNaN(d.getTime());
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const text = e.target.value;
      setLocalError(isValidDate(text) ? null : "Enter date as YYYY-MM-DD");
      if (onChange) onChange(e);
    }

    const displayError = error || localError || undefined;

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
          type="text"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          pattern="\d{4}-\d{2}-\d{2}"
          value={value}
          onChange={handleChange}
          className={cn(
            "w-full rounded-md border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-oagf-green focus:outline-none focus:ring-1 focus:ring-oagf-green",
            displayError && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className,
          )}
          {...props}
        />
        {displayError && <p className="mt-1 text-xs text-oagf-danger">{displayError}</p>}
        {hint && !displayError && <p className="mt-1 text-xs text-oagf-grey">{hint}</p>}
      </div>
    );
  },
);

DateInput.displayName = "DateInput";
