import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo, Card } from '@/components/ui';
export const AuthLayout = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="ft-hero-bg flex min-h-screen flex-col items-center justify-center gap-6 p-4">
    <Link to="/"><Logo /></Link>
    <Card className="w-full max-w-md space-y-4 p-6"><h1 className="text-2xl font-bold">{title}</h1>{children}</Card>
  </div>
);
