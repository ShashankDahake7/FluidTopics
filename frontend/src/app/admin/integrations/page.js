'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminIntegrationsIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/integrations/search-engine');
  }, [router]);
  return null;
}
