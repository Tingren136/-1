import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';

function buildMockUrls(key: string) {
  const base = process.env.OBJECT_STORAGE_PUBLIC_BASE_URL || DEFAULT_MOCK_BASE;
  return {
    uploadUrl: `${base}/upload/${key}`,
    assetUrl: `${base}/${key}`,
    mock: true,
  };
}

export async function POST() {
  const key = `sessions/${Date.now()}-${randomUUID()}`;
  const forceMock = process.env.OBJECT_STORAGE_MOCK !== '0';
  if (forceMock) {
    return NextResponse.json(buildMockUrls(key));
  }

  return NextResponse.json(
    {
      error: 'upload_not_configured',
      message:
        'Set OBJECT_STORAGE_MOCK=0 only after implementing a real object storage signer.',
    },
    { status: 501 },
  );
}