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
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Link to={`/u/${person.username}`}><Avatar name={person.display_name} src={person.avatar_url} size="lg" ring /></Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${person.username}`} className="block truncate font-semibold">{person.display_name}</Link>
          <p className="truncate text-sm text-muted">@{person.username}</p>
          <p className="mt-1 line-clamp-2 text-sm">{person.bio}</p>
        </div>
        <UserMenu userId={person.id} name={person.display_name} onBlocked={() => { setHidden(true); onHidden?.(person.id); }} />
      </div>
      <div className="flex flex-wrap gap-2">{person.languages.map((l) => <LanguageChip key={`${l.language_code}-${l.role}`} language={nameOf(l.language_code)} level={l.level} />)}</div>
      <div className="flex flex-wrap items-center gap-2"><FollowButton userId={person.id} initial={person.follow_status} /><MessageButton userId={person.id} /></div>
    </Card>
  );
}
