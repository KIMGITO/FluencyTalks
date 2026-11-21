import { Link, useParams } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { ChatThread, ConversationList } from '@/components/features';
export default function Messages() {
  const { id } = useParams();
  return id ? <ChatThread id={id} /> : (<><PageHeader title="Messages" />
    <Link to="/calls" className="ft-inset mb-3 inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 hover:underline"><Phone size={14} aria-hidden />Call history</Link>
    <ConversationList /></>);
}
