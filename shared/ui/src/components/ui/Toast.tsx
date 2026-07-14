import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useUIStore } from "../../store/uiStore";
import { cn } from "../../utils/cn";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: "bg-oagf-green-light text-oagf-green-dark border-oagf-green",
  error: "bg-oagf-danger-light text-oagf-danger border-oagf-danger",
  warning: "bg-orange-50 text-orange-800 border-orange-300",
  info: "bg-oagf-info-light text-oagf-info border-oagf-info",
};

export function ToastContainer() {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  return (
    <div className="fixed right-4 top-4 z-50 flex w-80 max-w-full flex-col gap-2 print:hidden">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 shadow-md transition-all",
              styles[toast.type],
            )}
          >
            <Icon size={20} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              {toast.title && <p className="font-semibold">{toast.title}</p>}
              <p className="text-sm">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded p-1 hover:bg-black/5"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
