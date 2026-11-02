import { Link } from 'react-router-dom';
import { Avatar, Card } from '@/components/ui';
import { usePresenceOf } from '@/hooks/usePresence';
import { LanguageChip, languageEntry } from '../LanguageChip';
import { CountryBadge } from '../CountryBadge';
import { useDisplayLocales, useLanguageStore } from '@/store/languageStore';
import type { Person } from '@/types/db';


export function PersonResult({ person }: { person: Person }) {
  const labelOf = useLanguageStore((s) => s.labelOf);
  const locales = useDisplayLocales();
  const online = !!usePresenceOf([person.id])[person.id]?.online;
  return (
    <Link to={`/u/${person.username}`} className="block">
      <Card className="flex items-center gap-3 transition hover:bg-surface-2">
        <Avatar
          name={person.display_name}
          src={person.avatar_url}
          size="lg"
          ring
          online={online}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{person.display_name}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <span className="truncate">@{person.username}</span>
            <CountryBadge
              code={person.country_code}
              timezone={person.timezone}
            />
          </p>
          {!!person.languages.length && (
            <div className="ft-chips mt-1">
              <LanguageChip
                className="mt-2"
                languages={person.languages.map((l) => languageEntry(l, labelOf(l, locales)))}
              />
            </div>
          )}
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand">
          View profile
        </span>
      </Card>
    </Link>
  );
}
