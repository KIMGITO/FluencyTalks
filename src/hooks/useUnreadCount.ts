import { useChatStore } from '@/store/chatStore';
export const useUnreadCount = () => useChatStore((s) => s.active.reduce((n, c) => n + Number(c.unread_count), 0) + s.requests.length);
