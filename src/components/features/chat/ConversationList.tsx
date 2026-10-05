import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Avatar, EmptyState, tabClass } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { usePresence } from '@/hooks/usePresence';
export function ConversationList() {
  const { active, requests } = useChatStore(); const [tab, setTab] = useState<'active' | 'request'>('active');
  const myId = useAuthStore((s) => s.user?.id ?? null);
  const { onlineIds } = usePresence(null, null, myId);   // lobby only: online dots
  const rows = tab === 'active' ? active : requests;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">{([['active', 'Chats'], ['request', `Requests${requests.length ? ` (${requests.length})` : ''}`]] as const).map(([k, label]) => (
        <button key={k} onClick={() => setTab(k)} className={tabClass(tab === k)}>{label}</button>))}</div>
      {!rows.length ? <EmptyState title={tab === 'active' ? 'No chats yet' : 'No requests'} text={tab === 'active' ? 'Search for someone and say hello.' : 'Messages from people you don\'t follow appear here first.'} /> : (
        <ul className="ft-card divide-y divide-border">{rows.map((c) => (
          <li key={c.conversation_id}><Link to={`/messages/${c.conversation_id}`} className="flex items-center gap-2.5 p-2.5 hover:bg-surface-2 md:p-3">
            <Avatar name={c.other_name} src={c.other_avatar} size="sm" online={onlineIds.includes(c.other_user_id)} />
            <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 truncate text-sm font-semibold">{c.other_name}{onlineIds.includes(c.other_user_id) && <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-label="Online" />}</p><p className={clsx('truncate text-xs', Number(c.unread_count) ? 'font-semibold text-ink' : 'text-muted', !c.last_body && 'italic')}>{c.last_body && c.last_body !== '[deleted]' ? c.last_body : 'No messages yet'}</p></div>
            <div className="shrink-0 text-right text-2xs text-muted">{formatTime(c.last_at)}{Number(c.unread_count) > 0 && <span className="ml-auto mt-1 block h-2.5 w-2.5 rounded-full bg-brand" />}</div>
          </Link></li>))}</ul>)}
    </div>
  );
}
