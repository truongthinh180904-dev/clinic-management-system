import { Suspense } from 'react';
import { AdminShell } from '@/components/layout/AdminShell';

export default function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
