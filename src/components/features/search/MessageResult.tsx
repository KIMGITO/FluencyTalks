import { Link } from 'react-router-dom';
import { Avatar, Card } from '@/components/ui';
import { formatTime } from '@/lib/format';
import type { MessageHit } from '@/types/db';


function windowAround(body: string, query: string, radius = 70) {
  const q = query.trim();
  const at = q ? body.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return { head: '', match: null as string | null, tail: body.length > radius * 2 ? `${body.slice(0, radius * 2)}…` : body };
  const from = Math.max(0, at - radius);
  return { head: (from > 0 ? '…' : '') + body.slice(from, at), match: body.slice(at, at + q.length), tail: body.slice(at + q.length, at + q.length + radius) };
}


export function MessageResult({ hit, query }: { hit: MessageHit; query: string }) {
  const part = windowAround(hit.body, query);
  const mine = hit.sender_id !== hit.other_id;   
  return (
    <Link to={`/messages/${hit.conversation_id}`} className="block">
      <Card className="flex items-start gap-2.5 transition hover:bg-surface-2">
        <Avatar name={hit.other_name} src={hit.other_avatar} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="font-semibold">{hit.other_name}</span>
            <span className="text-muted"> · @{hit.other_username}</span>
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug">
            {mine && <span className="text-muted">You: </span>}
            {part.head}
            {part.match && <mark className="rounded-sm bg-brand-soft px-0.5 font-semibold text-brand">{part.match}</mark>}
            {part.tail}
          </p>
        </div>
        <span className="shrink-0 text-2xs text-muted">{formatTime(hit.created_at)}</span>
      </Card>
    </Link>
  );
}