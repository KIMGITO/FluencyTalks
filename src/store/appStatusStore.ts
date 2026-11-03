import { useEffect } from 'react';
import { create } from 'zustand';
import { apiHooks } from '@/lib/api';
import { adminSetAppPaused, getAppStatus, subscribeToAppStatus, type AppStatus } from '@/services/appStatus';

const POLL_MS = 60_000;
let started = false;

interface S {
  status: AppStatus | null;
  refresh: () => Promise<void>;
  start: () => void;
  setPaused: (paused: boolean, reason: string, message?: string) => Promise<void>;
}

/**
 * Whether the app is paused, for the screens. The server is what enforces it, so if this can't be read the
 * page carries on and the API refuses anyway. A learner who was held at the gate reloads when it reopens,
 * because everything the page tried to load during the pause failed.
 */
export const useAppStatusStore = create<S>((set, get) => ({
  status: null,
  refresh: async () => {
    const before = get().status;
    try {
      const status = await getAppStatus();
      set({ status });
      if (before?.paused && !before.exempt && !status.paused) window.location.reload();
    } catch {
      if (!before) set({ status: { paused: false, message: null, since: null, exempt: false } });
    }
  },
  start: () => {
    if (started) return;
    started = true;
    apiHooks.onPaused = () => { void get().refresh(); };
    void get().refresh();
    subscribeToAppStatus(() => { void get().refresh(); });
    setInterval(() => { void get().refresh(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void get().refresh(); });
  },
  setPaused: async (paused, reason, message) => { set({ status: await adminSetAppPaused(paused, reason, message) }); },
}));

/** Screens that depend on the status mount this; public marketing pages don't, so they open no socket. */
export function useAppStatus() {
  const status = useAppStatusStore((s) => s.status);
  useEffect(() => { useAppStatusStore.getState().start(); }, []);
  return status;
}
