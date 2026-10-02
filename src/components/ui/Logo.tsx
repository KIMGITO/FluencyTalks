import { MessagesSquare } from 'lucide-react';
export const Logo = ({ compact }: { compact?: boolean }) => (
  <span className="flex items-center gap-2">
    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-grad-brand text-on-brand"><MessagesSquare size={20} /></span>
    {!compact && <span className="font-display text-xl font-bold">Fluency<span className="ft-gradient-text">Talks</span></span>}
  </span>
);
