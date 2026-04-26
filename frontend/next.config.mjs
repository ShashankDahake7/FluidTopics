/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:4000'}/uploads/:path*`,
      },
      {
        source: '/portal-asset/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/portal-asset/:path*`,
      },
    ];
  },
  async redirects() {
    // Legacy /portal page route → /dashboard. The /portal-asset/* rewrite
    // above is matched before redirects run and stays unaffected.
    //
    // /admin (the old admin landing dashboard) has been removed; deep links
    // and bookmarks to it now go to /dashboard. /admin/:path* sub-routes are
    // unaffected and continue to render their own pages.
    return [
      {
        source: '/portal',
        destination: '/dashboard',
        permanent: false,
      },
      {
        source: '/portal/:path*',
        destination: '/dashboard/:path*',
        permanent: false,
      },
      {
        source: '/admin',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
