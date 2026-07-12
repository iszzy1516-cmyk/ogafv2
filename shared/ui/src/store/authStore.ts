import { create } from "zustand";
import type { User } from "../types";
import * as api from "../services/api";

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isLocked: boolean;
  lastActivity: number;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
  recordActivity: () => void;
  lockSession: () => void;
  unlockSession: (password: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: false,
  error: null,
  isLocked: false,
  lastActivity: Date.now(),

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const session = await api.login({ username, password });
      set({
        token: session.token,
        user: session.user,
        isLoading: false,
        error: null,
        isLocked: false,
        lastActivity: Date.now(),
      });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: typeof err === "string" ? err : err instanceof Error ? err.message : "Login failed",
      });
      return false;
    }
  },

  logout: async () => {
    const { token } = get();
    if (token) {
      try {
        await api.logout(token);
      } catch {
        // ignore logout errors
      }
    }
    set({ token: null, user: null, error: null, isLocked: false });
  },

  restore: async () => {
    // In the real app this would check a secure storage token.
    // With the mock backend there is no persistent session.
    set({ token: null, user: null });
  },

  clearError: () => set({ error: null }),

  recordActivity: () => {
    set({ lastActivity: Date.now() });
  },

  lockSession: () => {
    const { user } = get();
    if (user) {
      set({ isLocked: true });
    }
  },

  unlockSession: async (password) => {
    const { user, token } = get();
    if (!user || !token) return false;
    try {
      await api.login({ username: user.username, password });
      set({ isLocked: false, lastActivity: Date.now(), error: null });
      return true;
    } catch (err) {
      set({
        error: typeof err === "string" ? err : err instanceof Error ? err.message : "Unlock failed",
      });
      return false;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    const { token } = get();
    if (!token) return false;
    set({ isLoading: true, error: null });
    try {
      await api.changePassword(token, currentPassword, newPassword);
      set((state) => ({
        isLoading: false,
        error: null,
        user: state.user ? { ...state.user, must_change_password: false } : null,
      }));
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: typeof err === "string" ? err : err instanceof Error ? err.message : "Failed to change password",
      });
      return false;
    }
  },
}));
