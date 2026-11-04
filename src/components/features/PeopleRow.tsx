import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { usePresenceOf } from '@/hooks/usePresence';
import { useDisplayLocales, useLanguageStore } from '@/store/languageStore';
import type { FeedPerson } from '@/types/db';
import { MessageButton } from './MessageButton';

/** Small and square, so it can't be mistaken for a post. The native language is what someone is here to find. */
function PersonSquare({ person, online }: { person: FeedPerson; online: boolean }) {
  const labelOf = useLanguageStore((s) => s.labelOf);
  const locales = useDisplayLocales();
  const name = (role: string) => { const l = person.languages.find((x) => x.role === role); return l ? labelOf(l, locales) : null; };
  const learning = name('learning');
  const note = person.last_chatted_at ? `Last chatted ${timeAgo(person.last_chatted_at)}` : learning ? `Learning ${learning}` : 'Happy to help';

  return (
    <li className="flex h-[11rem] w-[11rem] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <p className="truncate bg-brand px-2.5 py-1.5 font-display text-base font-medium leading-tight text-on-brand" title="Native language">{name('native') ?? 'Native speaker'}</p>
      <Link to={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
        <Avatar name={person.display_name} src={person.avatar_url} size="md" online={online} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{person.display_name}</span>
          <span className="block truncate text-xs text-muted">{note}</span>
        </span>
      </Link>
      <div className="px-2.5 pb-2.5 [&>div]:flex [&_button]:w-full"><MessageButton userId={person.id} /></div>
    </li>
  );
}

export function PeopleRow({ people }: { people: FeedPerson[] }) {
  const seen = usePresenceOf(people.map((p) => p.id));
  return (
    <section aria-label="People to practise with" className="min-w-0">
      <h2 className="ft-inset mb-2 text-sm font-semibold text-ink">People to practise with</h2>
      <ul className="ft-inset flex snap-x gap-2.5 overflow-x-auto pb-1 [scroll-padding-inline:0.75rem]">
        {people.map((p) => <PersonSquare key={p.id} person={p} online={!!seen[p.id]?.online} />)}
      </ul>
    </section>
  );
}
