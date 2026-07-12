import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  hideClose?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className, hideClose = false }: ModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !hideClose) onClose?.();
      }}
    >
      <div
        className={cn(
          "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-lg",
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-oagf-border px-5 py-4">
            <h3 className="text-lg font-semibold text-oagf-text">{title}</h3>
            {!hideClose && (
              <button
                onClick={() => onClose?.()}
                className="rounded p-1 text-oagf-grey hover:bg-oagf-offwhite hover:text-oagf-text"
                type="button"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
