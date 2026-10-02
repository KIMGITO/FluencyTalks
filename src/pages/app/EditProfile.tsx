import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Card } from '@/components/ui';
import { ProfileForm } from '@/components/features';
export default function EditProfile() {
  const nav = useNavigate();
  return (<><PageHeader title="Edit profile" /><Card><ProfileForm mode="edit" onDone={() => nav('/profile')} /></Card></>);
}
