// Streaming proxy for file uploads — bypasses Next.js rewrite body-size limit.
// Next.js App Router route handlers take precedence over rewrites for the same path.
export async function POST(request) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

  // Forward all headers except host (which would confuse the backend)
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() !== 'host') headers.set(key, value);
  }

  // Stream body directly — avoids buffering the entire file in memory
  const response = await fetch(`${backendUrl}/api/ingest/upload`, {
    method: 'POST',
    headers,
    body: request.body,
    duplex: 'half',
  });

  const data = await response.json().catch(() => ({}));
  return Response.json(data, { status: response.status });
}
