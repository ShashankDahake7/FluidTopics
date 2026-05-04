'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';

/**
 * Records `page.display` for Traffic → Page views (same contract as Fluid Topics).
 * Fires on mount and on every client-side route change.
 */
export default function FtPageViewTracker() {
  const pathname = usePathname();
  const last = useRef(null);

  useEffect(() => {
    void import('@/lib/clientIpHint').then(({ getClientGeoHint }) => getClientGeoHint());
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (last.current === pathname) return;
    last.current = pathname;
    const path = pathname.split('?')[0] || '/';
    const vw = typeof window !== 'undefined' ? window.innerWidth : null;
    const vh = typeof window !== 'undefined' ? window.innerHeight : null;
    api
      .post('/analytics/track', {
        eventType: 'event',
        data: {
          ftEvent: 'page.display',
          path,
          ...(typeof vw === 'number' &&
          typeof vh === 'number' &&
          vw > 0 &&
          vh > 0
            ? { viewportWidth: vw, viewportHeight: vh }
            : {}),
        },
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[FtPageViewTracker] Failed to POST /analytics/track:', err?.message || err);
        }
      });
  }, [pathname]);

  return null;
}
