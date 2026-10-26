import type { IncomingMessage, ServerResponse } from 'node:http';

interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
}

interface VercelResponse extends ServerResponse {
  status(code: number): this;
}

const hopByHopHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
]);

export const config = {
  api: {
    bodyParser: false,
  },
};

const requestBody = async (request: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export default async (request: VercelRequest, response: VercelResponse): Promise<void> => {
  const backendUrl = process.env.BACKEND_URL?.trim();
  if (!backendUrl) {
    response.status(503).end('The backend service is not configured.');
    return;
  }

  let backendOrigin: URL;
  try {
    backendOrigin = new URL(backendUrl);
  } catch {
    response.status(500).end('The backend service URL is invalid.');
    return;
  }
  if (!['http:', 'https:'].includes(backendOrigin.protocol)) {
    response.status(500).end('The backend service URL must use HTTP or HTTPS.');
    return;
  }

  const requestPath = request.url || '/';
  if (!requestPath.startsWith('/api/')) {
    response.status(404).end('Not found.');
    return;
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (!value || name.toLowerCase() === 'host' || hopByHopHeaders.has(name.toLowerCase())) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }

  try {
    const method = request.method || 'GET';
    const body = ['GET', 'HEAD'].includes(method)
      ? undefined
      : new Uint8Array(await requestBody(request));
    const upstream = await fetch(new URL(requestPath, backendOrigin), {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(55_000),
    });

    response.statusCode = upstream.status;
    upstream.headers.forEach((value, name) => {
      if (name !== 'set-cookie' && !hopByHopHeaders.has(name.toLowerCase())) {
        response.setHeader(name, value);
      }
    });
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) response.setHeader('set-cookie', cookies);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error('[API proxy] Backend request failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    response.status(502).end('The backend service is unavailable.');
  }
};
