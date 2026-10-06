import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AdminInbox from '@/components/AdminInbox';

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/admin/login');
  }

  return <AdminInbox />;
}
