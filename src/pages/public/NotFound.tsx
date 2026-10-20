import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useSeo } from '@/hooks/useSeo';
import { BRAND } from '@/lib/site';
export default function NotFound() {
  useSeo({ title: 'Page not found', description: `The page you asked for does not exist on ${BRAND}.`, path: '/404', noIndex: true });
  return <div className="flex h-screen flex-col items-center justify-center gap-4"><h1 className="text-4xl font-bold">Page not found</h1><p className="text-muted">That link doesn't lead anywhere.</p><Link to="/"><Button>Back to {BRAND}</Button></Link></div>;
}
