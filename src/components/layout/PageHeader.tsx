export const PageHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-4"><h1 className="text-2xl font-bold">{title}</h1>{subtitle && <p className="text-muted">{subtitle}</p>}</div>
);
