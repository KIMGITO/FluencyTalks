import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { KeyRound, LifeBuoy, ShieldCheck, ShieldX, Smartphone, type LucideIcon } from 'lucide-react';
import { Button, Card, ErrorState, Logo, Spinner, Toaster } from '@/components/ui';
import { IconTile, type Tone } from '@/components/features/admin/AdminKit';
import { useAction } from '@/hooks/useAction';
import { MfaChallenge, MfaEnroll, RecoveryCodes } from '@/components/features/admin/MfaForms';
import { supabase } from '@/lib/supabase';
import { myStaffStatus, type StaffTier } from '@/services/admin';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

type Step = 'loading' | 'failed' | 'not_staff' | 'needs_password' | 'enroll' | 'challenge' | 'codes' | 'ready';

const GateCard = ({ title, icon, tone, step, children }: { title: string; icon: LucideIcon; tone: Tone; step?: 1 | 2; children: ReactNode }) => {
  const leave = useAction(useAuthStore((s) => s.signOut));
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-deep px-4 py-8">
      <Logo light />
      <Card className="ft-page w-full max-w-md space-y-4 !rounded-lg !border p-5 shadow-pop sm:p-6">
    
        <div className="flex items-center gap-3"><IconTile icon={icon} tone={tone} /><h1 className="font-display text-2xl font-medium leading-tight">{title}</h1></div>
        {children}
      </Card>
      <button type="button" disabled={leave.busy} className="text-sm font-semibold text-on-deep/70 hover:text-on-deep disabled:opacity-60" onClick={() => void leave.run()}>{leave.busy ? 'Signing out…' : 'Sign out'}</button>
      <Toaster />
    </main>
  );
};

/**
 * The way into /admin. This only decides what to show: the database refuses every admin call
 * from a session that has not used a password and an authenticator code.
 */
export function AdminRoute() {
  const signOut = useAuthStore((s) => s.signOut);
  const role = useProfileStore((s) => s.me?.role);
  const [step, setStep] = useState<Step>('loading');
  const [tier, setTier] = useState<StaffTier | null>(null);

  const check = useCallback(async () => {
    try {
      const status = await myStaffStatus();
      if (!status.is_staff) { setStep('not_staff'); return; }
      setTier(status.tier ?? null);
      if (status.session_ok) { setStep('ready'); return; }
      if (!status.used_password) { setStep('needs_password'); return; }
      const { data } = await supabase.auth.mfa.listFactors();
      setStep(data?.totp.length ? 'challenge' : 'enroll');
    } catch { setStep('failed'); }
  }, []);
  useEffect(() => { void check(); }, [check]);

  switch (step) {
    case 'loading': return <div className="flex h-screen items-center justify-center"><Spinner /></div>;
    case 'failed': return <main className="mx-auto max-w-md p-4 pt-16"><ErrorState title="Couldn't check your access" onRetry={() => void check()} /></main>;
    // ProtectedRoute sends a staff role here, so going back would loop if the profile and the database disagree.
    case 'not_staff': return role === 'user' ? <Navigate to="/home" replace /> : (
      <GateCard title="No staff access" icon={ShieldX} tone="danger">
        <p className="text-sm text-muted">This account is marked as staff but has no staff record. Ask the super admin to check it. The steps are in docs/ADMIN_SETUP.md.</p>
      </GateCard>
    );
    case 'needs_password': return (
      <GateCard title="Log in with your password" icon={KeyRound} tone="accent">
        <p className="text-sm text-muted">Staff accounts always log in with their email and password, then an authenticator code. Google sign-in and email links can't open the admin area.</p>
        <Button full onClick={() => void signOut()}>Go to log in</Button>
      </GateCard>
    );
    case 'enroll': return (
      <GateCard title="Set up your authenticator" icon={Smartphone} tone="brand" step={1}>
        <p className="text-sm text-muted">Your account needs Google Authenticator before the admin area opens. Install it on your phone first.</p>
        <MfaEnroll friendlyName="Primary authenticator" onDone={() => setStep('codes')} />
      </GateCard>
    );
    case 'challenge': return (
      <GateCard title="Enter your code" icon={ShieldCheck} tone="accent">
        <MfaChallenge onDone={() => void check()} onRecovered={() => setStep('enroll')} />
      </GateCard>
    );
    case 'codes': return <GateCard title="Your recovery codes" icon={LifeBuoy} tone="sun" step={2}><RecoveryCodes onDone={() => void check()} /></GateCard>;
    case 'ready': return <Outlet context={tier} />;
  }
}
