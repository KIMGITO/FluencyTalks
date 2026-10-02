import clsx from 'clsx';
const sizes = { sm: 'h-8 w-8 text-sm', md: 'h-10 w-10 text-base', lg: 'h-16 w-16 text-xl', xl: 'h-24 w-24 text-3xl' };
export function Avatar({ name, src, size = 'md', online, ring }: { name: string; src?: string | null; size?: keyof typeof sizes; online?: boolean; ring?: boolean }) {
  const inner = src
    ? <img src={src} alt={name} className={clsx('rounded-full object-cover', sizes[size])} />
    : <div className={clsx('flex items-center justify-center rounded-full bg-brand-soft font-semibold text-brand', sizes[size])}>{name.slice(0, 1).toUpperCase()}</div>;
  return (
    <span className="relative inline-block shrink-0">
      {ring ? <span className="ft-avatar-ring block">{inner}</span> : inner}
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-success" />}
    </span>
  );
}
