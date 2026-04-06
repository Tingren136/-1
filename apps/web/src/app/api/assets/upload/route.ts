import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';
const DEFAULT_PROXY_UPLOAD_URL = 'https://catbox.moe/user/api.php';

function buildMockUrls(key: string) {
  const base = process.env.OBJECT_STORAGE_PUBLIC_BASE_URL || DEFAULT_MOCK_BASE;
  return {
    uploadUrl: `${base}/upload/${key}`,
    assetUrl: `${base}/${key}`,
    mock: true,
  };
}

function parseRemoteUrl(raw: string) {
  const firstLine = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return undefined;
  if (!/^https?:\/\//i.test(firstLine)) return undefined;
  return firstLine;
}

async function uploadViaPublicProxy(file: File) {
  const uploadEndpoint =
    process.env.OBJECT_STORAGE_PROXY_UPLOAD_URL || DEFAULT_PROXY_UPLOAD_URL;
  const formData = new FormData();
  const isCatbox = /catbox\.moe\/user\/api\.php/i.test(uploadEndpoint);
  if (isCatbox) {
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file, file.name || `upload-${Date.now()}`);
  } else {
    formData.append('file', file, file.name || `upload-${Date.now()}`);
  }

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    body: formData,
  });
  const text = await response.text();
  if (!response.ok) {
    const detail = text ? text.slice(0, 180) : 'empty response';
    throw new Error(`upload_proxy_failed (${response.status}): ${detail}`);
  }

  const assetUrl = parseRemoteUrl(text);
  if (!assetUrl) {
    throw new Error('upload_proxy_invalid_response');
  }

  return {
    uploadUrl: uploadEndpoint,
    assetUrl,
    mock: false,
  };
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    try {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'missing_file' }, { status: 400 });
      }

      if (file.size <= 0) {
        return NextResponse.json({ error: 'empty_file' }, { status: 400 });
      }

      const maxBytes = Number(
        process.env.OBJECT_STORAGE_MAX_BYTES || 10 * 1024 * 1024,
      );
      if (Number.isFinite(maxBytes) && file.size > maxBytes) {
        return NextResponse.json(
          { error: 'file_too_large', message: `max_bytes=${maxBytes}` },
          { status: 413 },
        );
      }

      const uploaded = await uploadViaPublicProxy(file);
      return NextResponse.json(uploaded);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'upload_failed';
      return NextResponse.json(
        { error: 'upload_failed', message },
        { status: 500 },
      );
    }
  }

  const isRealStep4Mode = process.env.JIMENG_MOCK === '0';
  if (isRealStep4Mode) {
    return NextResponse.json(
      {
        error: 'mock_upload_url_disabled',
        message:
          '当前为真实融合模式，请直接使用“本地图片上传”。不再提供 mock 图片地址。',
      },
      { status: 400 },
    );
  }

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
