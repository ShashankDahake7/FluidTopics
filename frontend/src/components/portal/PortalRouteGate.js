'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import api, { getStoredToken } from '@/lib/api';

export default function PortalRouteGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState('loading');

  const verify = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setPhase('guest');
      return;
    }
    try {
      await api.get('/auth/me');
      setPhase('authed');
    } catch {
      await api.signOut();
      setPhase('guest');
    }
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  useEffect(() => {
    const onSync = () => verify();
    window.addEventListener('storage', onSync);
    window.addEventListener('ft-auth', onSync);
    return () => {
      window.removeEventListener('storage', onSync);
      window.removeEventListener('ft-auth', onSync);
    };
  }, [verify]);

  useEffect(() => {
    if (phase !== 'guest') return;
    if (pathname) {
      try {
        sessionStorage.setItem('portal_redirect', pathname);
      } catch {
        /* ignore */
      }
    }
    router.replace('/login');
  }, [phase, pathname, router]);

  if (phase !== 'authed') {
    return (
      <main className="portal-shell-main portal-gate-loading-main">
        <div className="portal-gate-loading">
          <div className="portal-gate-spinner" />
        </div>
      </main>
    );
  }

  return <main className="portal-shell-main">{children}</main>;
}
