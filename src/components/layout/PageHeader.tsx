export const PageHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-3 md:mb-4"><h1 className="text-xl font-bold md:text-2xl capitalize">{title}</h1>{subtitle && <p className="text-sm text-muted">{subtitle}</p>}</div>
);
