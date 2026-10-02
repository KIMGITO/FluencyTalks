import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { ChatThread, ConversationList } from '@/components/features';
export default function Messages() {
  const { id } = useParams();
  return id ? <ChatThread id={id} /> : (<><PageHeader title="Messages" /><ConversationList /></>);
}
