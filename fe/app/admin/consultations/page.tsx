import { redirect } from 'next/navigation';

export default function AdminConsultationsRedirectPage() {
  redirect('/visits');
}
