import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast { id: number; kind: ToastKind; text: string; retry?: () => void }

let next = 1;
interface S { toasts: Toast[]; push: (kind: ToastKind, text: string, retry?: () => void) => void; dismiss: (id: number) => void }

export const useToastStore = create<S>((set, get) => ({
  toasts: [],
  push: (kind, text, retry) => {
    const id = next++;
    // One at a time: a new message replaces the one showing, so they never stack up the screen.
    set({ toasts: [{ id, kind, text, retry }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 7000 : 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Say what happened, from anywhere. Only call success once the server has confirmed. */
export const toast = {
  success: (text: string) => useToastStore.getState().push('success', text),
  error: (text: string, retry?: () => void) => useToastStore.getState().push('error', text, retry),
  info: (text: string) => useToastStore.getState().push('info', text),
};
