import type { ReactNode } from 'react';
import Maintenance from '@/pages/public/Maintenance';
import { useAppStatus } from '@/store/appStatusStore';

/** For signed-out pages that lead into the app. The database refuses new accounts during a pause; this explains why. */
export function PausedGate({ children }: { children: ReactNode }) {
  const status = useAppStatus();
  return status?.paused && !status.exempt ? <Maintenance /> : <>{children}</>;
}
