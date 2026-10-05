import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Card } from '@/components/ui';
import { LanguageChip } from './LanguageChip';
import { CountryBadge } from './CountryBadge';
import { MatchBadge } from './MatchBadge';
import { FollowButton } from './FollowButton';
import { MessageButton } from './MessageButton';
import { UserMenu } from './UserMenu';
import { useDisplayLocales, useLanguageStore } from '@/store/languageStore';
import type { FeedPerson, Person } from '@/types/db';

/** `match` is only passed by the Home feed; search and follow lists omit it. */
export function ProfileCard({ person, match, onHidden }: {
  person: FeedPerson | Person; match?: { kind: FeedPerson['match_kind']; language?: string | null }; onHidden?: (id: string) => void;
}) {
  const labelOf = useLanguageStore((s) => s.labelOf); const locales = useDisplayLocales(); const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const kind = match?.kind ?? ('match_kind' in person ? person.match_kind : 'other');
  const language = match?.language ?? ('match_language' in person ? person.match_language : null);
  return (
    // Compact row: small avatar, tight gaps, actions inline with the chips.
    <Card className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <Link to={`/u/${person.username}`}><Avatar name={person.display_name} src={person.avatar_url} size="md" ring /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link to={`/u/${person.username}`} className="truncate font-semibold leading-tight">{person.display_name}</Link>
            <MatchBadge kind={kind} language={language} />
            <UserMenu userId={person.id} name={person.display_name} onBlocked={() => { setHidden(true); onHidden?.(person.id); }} />
          </div>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted">
            <span className="truncate">@{person.username}</span>
            <CountryBadge code={person.country_code} timezone={person.timezone} />
          </p>
          {person.bio && <p className="mt-1 line-clamp-2 text-sm leading-snug">{person.bio}</p>}
        </div>
      </div>
      <div className="ft-chips">{person.languages.map((l) => <LanguageChip key={`${l.language_id}-${l.role}`} language={labelOf(l, locales)} level={l.level} />)}</div>
      <div className="flex flex-wrap items-center gap-1.5"><FollowButton userId={person.id} initial={person.follow_status} /><MessageButton userId={person.id} /></div>
    </Card>
  );
}
