/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 buffers proxied request bodies (rewrites → backend) and caps the
  // buffer at 10MB by default, which truncates large publication ZIPs and
  // hangs the upstream upload with ECONNRESET. Raise the cap to match the
  // backend's MAX_FILE_SIZE so the proxy never silently chops a body.
  // Lives under `experimental` in Next 16.x — see
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/middlewareClientMaxBodySize
  experimental: {
    proxyClientMaxBodySize: '500mb',
  },
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
