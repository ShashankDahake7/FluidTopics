'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Locale admin UI removed from navigation; old URLs land on dashboard. */
export default function AdminLocaleRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div className="spinner" />
    </div>
  );
}
