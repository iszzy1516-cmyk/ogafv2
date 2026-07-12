import { useEffect, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import { SESSION_TIMEOUT_MS } from "../utils/constants";

export function useSessionTimeout() {
  const { token, isLocked, recordActivity, lockSession } = useAuthStore();

  const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];

  const handleActivity = useCallback(() => {
    recordActivity();
  }, [recordActivity]);

  useEffect(() => {
    if (!token || isLocked) return;

    const events = activityEvents;
    events.forEach((event) => window.addEventListener(event, handleActivity));

    const interval = setInterval(() => {
      const state = useAuthStore.getState();
      const inactiveFor = Date.now() - state.lastActivity;
      if (inactiveFor >= SESSION_TIMEOUT_MS) {
        lockSession();
      }
    }, 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      clearInterval(interval);
    };
  }, [token, isLocked, handleActivity, lockSession]);
}
