import { create } from "zustand";

export type ToastType = "success" | "warning" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface UIState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((state) => ({ toasts: [...state.toasts, { id, ...toast }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }),
    ),
  clearToasts: () => set({ toasts: [] }),
}));
