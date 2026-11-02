import { Ban, CircleCheck, CirclePause } from 'lucide-react';
import type { AccountStatus } from '@/types/db';
import { Chip, type Tone } from './AdminKit';

const look: Record<AccountStatus, { tone: Tone; icon: typeof Ban }> = { active: { tone: 'success', icon: CircleCheck }, suspended: { tone: 'sun', icon: CirclePause }, banned: { tone: 'danger', icon: Ban } };
export const StatusBadge = ({ status }: { status: AccountStatus }) => <Chip tone={look[status].tone} icon={look[status].icon}><span className="capitalize">{status}</span></Chip>;
