// Shared with the send-push edge function, so a push reads the same as the page. Keep it free of app imports.
export interface NotificationLike {
  type: string;
  actor_username?: string | null;
  data: { reason?: string; conversation_id?: string; points?: number; level?: string; post_id?: string; item_id?: string; phrase?: string; note?: string; status?: string; granted?: boolean; paused?: boolean; waiting?: boolean | number; overdue?: number; bounty?: boolean };
}

/** The sentence after the actor's name; system notices have no actor. */
export const notificationVerb = (n: NotificationLike): string => {
  const about = n.data.phrase ? ` “${n.data.phrase}”` : ' a post';
  switch (n.type) {
    case 'message_request': return 'sent you a message request';
    case 'correction': return 'suggested a correction to your message';
    case 'correction_accepted': return n.data.points ? `accepted your correction. You earned ${n.data.points} points` : 'accepted your correction';
    case 'bounty_paid': return `accepted your answer. You earned ${n.data.points ?? 0} points`;
    case 'correction_declined': return `declined your ${n.data.bounty ? 'bounty answer' : 'correction'}${n.data.note ? `: “${n.data.note}”` : ''}`;
    case 'correction_superseded': return 'chose another answer to their bounty';
    case 'bounty_reminder': return `Your bounty has ${n.data.waiting ?? 'some'} answer${n.data.waiting === 1 ? '' : 's'} waiting and expires soon. Accept one or it is refunded`;
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
    case 'post_override': return `A moderator changed a decision on${about} to ${n.data.status}. ${n.data.note ?? ''}`.trim();
    case 'help_request': return `is asking for help with${about}. Can you fix it?`;
    case 'help_fix': return `sent a fix for your post${about}`;
    case 'help_thanked': return `thanked you for your fix on${about}${n.data.points ? `. You earned ${n.data.points} points` : ''}`;
    case 'action_reminder': return `A correction on${about} is still waiting for your decision`;
    case 'action_overdue': return n.data.waiting ? `Your correction on${about} is past its decision deadline` : `A decision on${about} is overdue`;
    case 'action_escalated': return `A decision on${about} needs a moderator`;
    case 'restriction_applied': return `New posts are paused: ${n.data.overdue ?? 'several'} decisions are overdue. Answer them, ask for time, or appeal`;
    case 'restriction_lifted': return 'You can post again';
    case 'appeal_decided': return `Your appeal was ${n.data.granted ? 'granted' : 'not granted'}. ${n.data.note ?? ''}`.trim();
    case 'admin_report': return `New report${n.data.reason ? `: ${n.data.reason}` : ''}. It needs a decision`;
    case 'admin_security': return 'A recovery code was used on a staff account';
    case 'admin_appeal': return 'Someone appealed a posting restriction. It needs an answer';
    case 'admin_site': return `${n.data.paused ? 'The app was paused for users' : 'The app is back on for users'}${n.data.note ? `: ${n.data.note}` : ''}`;
    default: return 'sent you a notification';
  }
};

/** System notices stand on their own, without "Someone" in front. */
export const hasActor = (n: NotificationLike) => !['level_up', 'bounty_reminder', 'action_reminder', 'action_overdue', 'action_escalated', 'restriction_applied', 'restriction_lifted', 'admin_report', 'admin_security', 'admin_appeal', 'admin_site', 'post_override'].includes(n.type) && (n.type !== 'appeal_decided');

export const notificationLink = (n: NotificationLike): string => {
  if (n.type === 'admin_report') return '/admin/reports';
  if (n.type === 'admin_security') return '/admin/logs';
  if (n.type === 'admin_appeal' || n.type === 'action_escalated') return '/admin/decisions';
  if (n.type === 'admin_site') return '/admin';
  if (n.data.post_id) return `/library/post/${n.data.post_id}${n.data.item_id ? `?item=${n.data.item_id}` : ''}`;
  if (n.type === 'level_up' || n.type === 'level_vouch') return '/profile/edit';
  // A bounty helper is usually not in the asker's chat: their answers page shows the outcome.
  if (n.type === 'bounty_paid' || n.type === 'correction_superseded' || (n.type === 'correction_declined' && !n.data.conversation_id)) return '/bounty-queue?tab=answers';
  if (n.type === 'restriction_applied' || n.type === 'restriction_lifted' || n.type === 'appeal_decided') return '/notifications';
  if (n.type === 'message_request' || n.type === 'correction' || n.type === 'correction_accepted' || n.type === 'correction_declined' || n.type === 'bounty_reminder') return n.data.conversation_id ? `/messages/${n.data.conversation_id}` : '/messages';
  return n.actor_username ? `/u/${n.actor_username}` : '/home';
};

export const CATEGORY_LABEL = { corrections: 'Correction', decisions: 'Decision', reminders: 'Reminder', system: 'Notice', reports: 'Report', escalations: 'Needs a decision', security: 'Security' } as const;
