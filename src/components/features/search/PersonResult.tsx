import { Link } from 'react-router-dom';
import { Avatar, Card } from '@/components/ui';
import { LanguageChip } from '../LanguageChip';
import { CountryBadge } from '../CountryBadge';
import { useLanguageStore } from '@/store/languageStore';
import type { Person } from '@/types/db';

/** Someone whose @handle is exactly what was typed, shown above the list the way Facebook puts the matching profile on top. */
export function PersonResult({ person }: { person: Person }) {
  const nameOf = useLanguageStore((s) => s.name);
  return (
    <Link to={`/u/${person.username}`} className="block">
      <Card className="flex items-center gap-3 transition hover:bg-surface-2">
        <Avatar name={person.display_name} src={person.avatar_url} size="lg" ring />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{person.display_name}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <span className="truncate">@{person.username}</span>
            <CountryBadge code={person.country_code} timezone={person.timezone} />
          </p>
          {!!person.languages.length && (
            <div className="ft-chips mt-1">{person.languages.slice(0, 4).map((l) => <LanguageChip key={`${l.language_code}-${l.role}`} language={nameOf(l.language_code)} level={l.level} />)}</div>
          )}
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand">View profile</span>
      </Card>
    </Link>
  );
}