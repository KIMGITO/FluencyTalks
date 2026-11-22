import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Video } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { HomePulse } from '@/components/features/HomePulse';
import { usePersonStatus } from '@/hooks/usePersonStatus';
import { listConnections, type PersonLite } from '@/services/connections';

const SHOWN = 12;

/** The column on the right on wide screens, like a social home page: what's live (on Home), then your partners. */
export const RightRail = () => {
  const { pathname } = useLocation();
  return (
    <aside className="sticky top-[var(--layout-topbarH)] hidden h-[calc(100dvh-var(--layout-topbarH))] space-y-5 overflow-y-auto px-3 py-6 lg:block">
      {pathname === '/home' && <HomePulse />}
      <Partners />
    </aside>
  );
};

/** Partners, online first, each one tap from a call. */
function Partners() {
  const nav = useNavigate();
  const [list, setList] = useState<PersonLite[] | null>(null);
  useEffect(() => { listConnections().then(setList).catch(() => setList([])); }, []);
  const people = usePersonStatus((list ?? []).map((p) => p.id));
  const sorted = useMemo(() => [...(list ?? [])].sort((a, b) => Number(!!people.status[b.id]?.online) - Number(!!people.status[a.id]?.online)), [list, people.status]);
  if (!sorted.length) return null;
  return (
    <section aria-label="Partners">
      <div className="mb-1 flex items-baseline justify-between px-2">
        <h2 className="text-sm font-semibold text-muted">Partners</h2>
        {sorted.length > SHOWN && <Link to="/people" className="text-xs font-semibold text-brand hover:underline">See all</Link>}
      </div>
      <ul>
        {sorted.slice(0, SHOWN).map((p) => {
          const st = people.status[p.id];
          const name = p.display_name || p.username || '';
          return (
            <li key={p.id} className="group flex items-center gap-1 rounded-md hover:bg-surface-2">
              <Link to={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5">
                <Avatar name={name} src={p.avatar_url} size="sm" online={!!st?.online} busy={!!st?.in_call} />
                <span className="truncate text-sm font-semibold text-ink">{name}</span>
              </Link>
              {st?.can_call && !st.in_call && (
                <button type="button" aria-label={`Call ${name}`} title={`Call ${name}`} onClick={() => nav(`/call/new?to=${p.id}`, { state: { name, avatar: p.avatar_url } })}
                  className="mr-1 rounded-full p-2 text-muted opacity-0 transition-opacity hover:bg-surface hover:text-brand focus-visible:opacity-100 group-hover:opacity-100">
                  <Video size={16} aria-hidden />
                </button>)}
            </li>);
        })}
      </ul>
    </section>
  );
}
