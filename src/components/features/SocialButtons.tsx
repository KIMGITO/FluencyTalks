import { useState, type ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';

type Provider = 'google' | 'apple' | 'facebook';

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">{children}</svg>
);

/* Provider logos keep their official brand colours. Apple uses currentColor so it works in dark mode. */
const providers: { id: Provider; label: string; icon: ReactNode }[] = [
  // {
  //   id: 'facebook',
  //   label: 'Continue with Facebook',
  //   icon: (
  //     <Svg>
  //       <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.23 2.69.23v2.95h-1.52c-1.49 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z" />
  //     </Svg>
  //   ),
  // },
  {
    id: 'google',
    label: 'Continue with Google',
    icon: (
      <Svg>
        <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.63H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.37l4-3.09z" />
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
      </Svg>
    ),
  },
  // {
  //   id: 'apple',
  //   label: 'Continue with Apple',
  //   icon: (
  //     <Svg>
  //       <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  //     </Svg>
  //   ),
  // },
  
];

export function SocialButtons() {
  const signInWithProvider = useAuthStore((s) => s.signInWithProvider);
  const error = useAuthStore((s) => s.error);
  const [pending, setPending] = useState<Provider | null>(null);
  const [attempted, setAttempted] = useState(false);

  const go = async (id: Provider) => {
    setPending(id);
    setAttempted(true);
    try { await signInWithProvider(id); } finally { setPending(null); }
  };

  return (
    <div className="mx-auto grid w-full max-w-xs gap-4">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={pending !== null}
          aria-busy={pending === p.id}
          onClick={() => go(p.id)}
          className="flex h-auto py-3  w-full items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-ink shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {/* Fixed-width inner row: icons share one vertical line, labels share another, and the pair stays centred */}
          <span className="flex w-52 items-center gap-3">
            {p.icon}
            <span className="truncate text-left">{pending === p.id ? 'Connecting…' : p.label}</span>
          </span>
        </button>
      ))}
      {/* OAuth failures (e.g. a redirect URL the dashboard has not allow-listed) land here. */}
      {attempted && error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}