// Shared with the send-push edge function, so a push reads the same as the page. Keep it free of app imports.
export interface NotificationLike {
  type: string;
  actor_username?: string | null;
  data: { conversation_id?: string; points?: number; level?: string; post_id?: string; item_id?: string; phrase?: string; note?: string; status?: string; granted?: boolean; waiting?: boolean; overdue?: number };
}

/** The sentence after the actor's name; system notices have no actor. */
export const notificationVerb = (n: NotificationLike): string => {
  const about = n.data.phrase ? ` “${n.data.phrase}”` : ' a post';
  switch (n.type) {
    case 'message_request': return 'sent you a message request';
    case 'correction': return 'suggested a correction to your message';
    case 'correction_accepted': return n.data.points ? `accepted your correction. You earned ${n.data.points} points` : 'accepted your correction';
    case 'bounty_paid': return `accepted your answer. You earned ${n.data.points ?? 0} points`;
    case 'level_up': return `You're now verified at ${n.data.level}`;
    case 'level_vouch': return 'vouched for your level';
    case 'post_correction': return `proposed a correction to your post${about}. It needs your decision`;
    case 'post_clarification': return `asked for clarification on your post${about}`;
    case 'post_challenged': return `challenged your correction on${about}`;
    case 'post_reply': return `replied in the discussion on${about}`;
    case 'post_endorsed': return `confirmed your post${about} is correct`;
    case 'post_accepted': return `accepted your correction on${about}${n.data.points ? `. You earned ${n.data.points} points` : ''}`;
    case 'post_declined': return `declined your correction on${about}`;
    case 'post_withdrawn': return `withdrew their proposal on${about}`;
    case 'post_superseded': return `accepted a newer correction on${about}, replacing yours`;
    case 'post_resolved': return `closed the clarification on${about}`;
    case 'post_reverted': return `went back to the original of${about}`;
    case 'post_override': return `changed a decision on${about} to ${n.data.status}. ${n.data.note ?? ''}`.trim();
    case 'action_reminder': return `A correction on${about} is still waiting for your decision`;
    case 'action_overdue': return n.data.waiting ? `Your correction on${about} is past its decision deadline` : `A decision on${about} is overdue`;
    case 'action_escalated': return `A decision on${about} needs a moderator`;
    case 'restriction_applied': return `New posts are paused: ${n.data.overdue ?? 'several'} decisions are overdue. Answer them, ask for time, or appeal`;
    case 'restriction_lifted': return 'You can post again';
    case 'appeal_decided': return `Your appeal was ${n.data.granted ? 'granted' : 'not granted'}. ${n.data.note ?? ''}`.trim();
    default: return 'sent you a notification';
  }
};

/** System notices stand on their own, without "Someone" in front. */
export const hasActor = (n: NotificationLike) => !['level_up', 'action_reminder', 'action_overdue', 'action_escalated', 'restriction_applied', 'restriction_lifted'].includes(n.type) && (n.type !== 'appeal_decided');

export const notificationLink = (n: NotificationLike): string => {
  if (n.data.post_id) return `/library/post/${n.data.post_id}${n.data.item_id ? `?item=${n.data.item_id}` : ''}`;
  if (n.type === 'level_up' || n.type === 'level_vouch') return '/profile/edit';
  if (n.type === 'bounty_paid') return '/points-history';   // the helper is not in the asker's chat
  if (n.type === 'restriction_applied' || n.type === 'restriction_lifted' || n.type === 'appeal_decided') return '/notifications';
  if (n.type === 'message_request' || n.type === 'correction' || n.type === 'correction_accepted') return n.data.conversation_id ? `/messages/${n.data.conversation_id}` : '/messages';
  return n.actor_username ? `/u/${n.actor_username}` : '/home';
};

export const CATEGORY_LABEL = { corrections: 'Correction', decisions: 'Decision', reminders: 'Reminder', system: 'Notice' } as const;
