import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Card } from '@/components/ui';
import { LanguageChip } from './LanguageChip';
import { FollowButton } from './FollowButton';
import { MessageButton } from './MessageButton';
import { UserMenu } from './UserMenu';
import { useLanguageStore } from '@/store/languageStore';
import type { Person } from '@/types/db';

export function ProfileCard({ person, onHidden }: { person: Person; onHidden?: (id: string) => void }) {
  const nameOf = useLanguageStore((s) => s.name); const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    // Compact row: small avatar, tight gaps, actions inline with the chips.
    <Card className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <Link to={`/u/${person.username}`}><Avatar name={person.display_name} src={person.avatar_url} size="md" ring /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link to={`/u/${person.username}`} className="truncate font-semibold leading-tight">{person.display_name}</Link>
            <UserMenu userId={person.id} name={person.display_name} onBlocked={() => { setHidden(true); onHidden?.(person.id); }} />
          </div>
          <p className="truncate text-xs text-muted">@{person.username}</p>
          {person.bio && <p className="mt-1 line-clamp-2 text-sm leading-snug">{person.bio}</p>}
        </div>
      </div>
      <div className="ft-chips">{person.languages.map((l) => <LanguageChip key={`${l.language_code}-${l.role}`} language={nameOf(l.language_code)} level={l.level} />)}</div>
      <div className="flex flex-wrap items-center gap-1.5"><FollowButton userId={person.id} initial={person.follow_status} /><MessageButton userId={person.id} /></div>
    </Card>
  );
}
