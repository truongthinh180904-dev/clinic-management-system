import { redirect } from 'next/navigation';

export default function AdminPatientsRedirectPage() {
  redirect('/patients');
}
