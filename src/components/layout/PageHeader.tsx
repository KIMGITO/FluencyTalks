export const PageHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-4 md:mb-6">
    <h1 className="font-display text-3xl font-medium capitalize leading-tight md:text-4xl">{title}</h1>
    {subtitle && <p className="mt-1 text-sm text-muted md:text-base">{subtitle}</p>}
  </div>
);
