import { NextResponse } from 'next/server';

const FORWARD_HEADER_KEYS = [
  'range',
  'if-none-match',
  'if-modified-since',
] as const;

const RETURN_HEADER_KEYS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
  'content-disposition',
] as const;

function parseAllowedHosts() {
  const raw = process.env.ASSET_PROXY_ALLOWED_HOSTS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedTarget(target: URL) {
  if (!['http:', 'https:'].includes(target.protocol)) {
    return false;
  }

  const allowedHosts = parseAllowedHosts();
  if (allowedHosts.length === 0) {
    return true;
  }

  const host = target.hostname.toLowerCase();
  return allowedHosts.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'missing_url' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  if (!isAllowedTarget(target)) {
    return NextResponse.json({ error: 'forbidden_target' }, { status: 403 });
  }

  const headers = new Headers();
  for (const key of FORWARD_HEADER_KEYS) {
    const value = request.headers.get(key);
    if (value) {
      headers.set(key, value);
    }
  }

  const upstream = await fetch(target.toString(), {
    method: 'GET',
    headers,
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!upstream.ok && upstream.status !== 206 && upstream.status !== 304) {
    const message = await upstream.text().catch(() => '');
    return NextResponse.json(
      {
        error: 'proxy_fetch_failed',
        status: upstream.status,
        message: message.slice(0, 220),
      },
      { status: upstream.status },
    );
  }

  const responseHeaders = new Headers();
  for (const key of RETURN_HEADER_KEYS) {
    const value = upstream.headers.get(key);
    if (value) {
      responseHeaders.set(key, value);
    }
  }
  responseHeaders.set('x-asset-proxy', '1');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
