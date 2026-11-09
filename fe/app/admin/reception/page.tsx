import { redirect } from 'next/navigation';

export default function AdminReceptionRedirectPage() {
  redirect('/patients');
}
