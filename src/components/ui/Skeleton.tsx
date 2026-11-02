import clsx from 'clsx';
import { Card } from './Card';

/** Grey shape in place of content that is really on its way. Not for actions: buttons have `loading`. */
export const Skeleton = ({ className }: { className?: string }) => <span aria-hidden className={clsx('ft-skeleton block rounded-md', className)} />;

/** Announces once for the whole group, so a screen reader doesn't read every shape. */
const Group = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div role="status" aria-label={label} className={className}>{children}</div>
);

const PostShape = () => (
  <Card className="space-y-3">
    <div className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-1/4" /></div></div>
    <Skeleton className="h-36 w-full rounded-xl" />
    <Skeleton className="h-3 w-2/3" />
  </Card>
);
const RowShape = () => (
  <Card className="flex items-start gap-3">
    <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
    <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-1/4" /></div>
  </Card>
);
const repeat = (n: number, el: React.ReactNode) => Array.from({ length: n }, (_, i) => <span key={i} className="contents">{el}</span>);

export const PostListSkeleton = ({ count = 3 }: { count?: number }) => <Group label="Loading posts" className="space-y-2">{repeat(count, <PostShape />)}</Group>;
export const RowListSkeleton = ({ count = 4, label = 'Loading' }: { count?: number; label?: string }) => <Group label={label} className="space-y-2">{repeat(count, <RowShape />)}</Group>;
export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <Group label="Loading" className="ft-inset space-y-3 py-2">
    {repeat(rows, <div className="flex gap-3"><Skeleton className="h-4 w-1/5" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-1/6" /></div>)}
  </Group>
);
export const ProfileSkeleton = () => (
  <Group label="Loading profile" className="space-y-3">
    <Card className="space-y-3">
      <div className="flex items-center gap-3"><Skeleton className="h-16 w-16 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-3 w-1/3" /></div></div>
      <Skeleton className="h-3 w-3/5" /><Skeleton className="h-3 w-2/5" />
    </Card>
    <PostShape />
  </Group>
);
export const ChatSkeleton = () => (
  <Group label="Loading conversation" className="ft-thread-shell space-y-3 p-4">
    <div className="flex items-center gap-3 pb-2"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-4 w-1/3" /></div>
    {[['w-2/3', ''], ['w-1/2', 'ml-auto'], ['w-3/5', 'ml-auto'], ['w-2/5', ''], ['w-1/2', '']].map(([w, side], i) => <Skeleton key={i} className={clsx('h-12 rounded-lg', w, side)} />)}
  </Group>
);
/** A post with a thread under it: the shape keeps the page from jumping when it arrives. */
export const ThreadSkeleton = () => (
  <Group label="Loading discussion" className="space-y-3">
    <Card className="space-y-3"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-8 w-4/5" /><Skeleton className="h-3 w-1/2" /></Card>
    {[0, 1, 1, 0].map((indent, i) => (
      <div key={i} className={clsx(indent ? 'ml-5 border-l-2 border-border pl-3' : '')}>
        <div className="flex gap-2.5"><Skeleton className="h-8 w-8 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-4/5" /></div></div>
      </div>
    ))}
  </Group>
);
export const NotificationSkeleton = () => (
  <Group label="Loading notifications" className="ft-card divide-y divide-border">
    {repeat(6, <div className="flex items-start gap-3 p-3"><Skeleton className="h-9 w-9 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/4" /></div></div>)}
  </Group>
);
