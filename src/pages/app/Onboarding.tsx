import { Navigate, useNavigate } from 'react-router-dom';
import { Card, Logo } from '@/components/ui';
import { ProfileForm } from '@/components/features';
import { useProfileStore } from '@/store/profileStore';
export default function Onboarding() {
  const nav = useNavigate(); const done = useProfileStore((s) => s.me?.onboarding_done);
  if (done) return <Navigate to="/home" replace />;
  return (
    <div className="ft-hero-bg flex min-h-screen flex-col items-center gap-6 p-4 py-10">
      <Logo />
      <Card className="w-full max-w-lg space-y-2 p-6">
        <h1 className="text-2xl font-bold">Set up your profile</h1>
        <p className="pb-2 text-muted">Tell people what you speak and what you're learning so they can find you.</p>
        <ProfileForm mode="onboarding" onDone={() => nav('/home')} />
      </Card>
    </div>
  );
}
