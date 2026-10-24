
export function EmailLink({
  email,
  subject,
  body,
  children,
  className,
}: {
  email: string;
  subject?: string;
  body?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const query = params.toString();
  return (
    <a href={`mailto:${email}${query ? `?${query}` : ''}`} className={className}>
      {children ?? email}
    </a>
  );
}
