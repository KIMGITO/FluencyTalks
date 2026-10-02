import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
export default function NotFound() {
  return <div className="flex h-screen flex-col items-center justify-center gap-4"><h1 className="text-4xl font-bold">Page not found</h1><p className="text-muted">That link doesn't lead anywhere.</p><Link to="/"><Button>Back to FluencyTalks</Button></Link></div>;
}
