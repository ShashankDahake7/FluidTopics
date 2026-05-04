'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';

/**
 * Fires $pageview on client-side navigations (App Router).
 * instrumentation-client initializes PostHog before the app bundle runs.
 * Uses pathname only (no useSearchParams) so the root layout does not force
 * a Suspense boundary on every route during static generation.
 */
export default function PostHogPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
    if (!pathname) return;
    posthog.capture('$pageview', {
      $current_url: typeof window !== 'undefined' ? window.location.href : pathname,
    });
  }, [pathname]);

  return null;
}
