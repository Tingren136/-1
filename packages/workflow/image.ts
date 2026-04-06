import sharp from 'sharp';

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';
const DEFAULT_PROXY_UPLOAD_URL = 'https://catbox.moe/user/api.php';

function getMockBase() {
  return process.env.OBJECT_STORAGE_PUBLIC_BASE_URL || DEFAULT_MOCK_BASE;
}

function shouldUseFlipMock() {
  if (process.env.IMAGE_FLIP_MOCK === '0') {
    return false;
  }
  if (process.env.IMAGE_FLIP_MOCK === '1') {
    return true;
  }
  return process.env.TENCENT3D_MOCK !== '0';
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

async function uploadPngBuffer(buffer: Buffer, fileName: string) {
  const uploadEndpoint =
    process.env.OBJECT_STORAGE_PROXY_UPLOAD_URL || DEFAULT_PROXY_UPLOAD_URL;
  const formData = new FormData();
  const isCatbox = /catbox\.moe\/user\/api\.php/i.test(uploadEndpoint);
  // ts-node 下 Buffer/Uint8Array 的 ArrayBufferLike 可能触发类型不兼容，这里切成标准 ArrayBuffer。
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'image/png' });

  if (isCatbox) {
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', blob, fileName);
  } else {
    formData.append('file', blob, fileName);
  }

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    body: formData,
  });
  const text = await response.text();
  if (!response.ok) {
    const detail = text ? text.slice(0, 180) : 'empty response';
    throw new Error(`flip_upload_failed (${response.status}): ${detail}`);
  }

  const assetUrl = parseRemoteUrl(text);
  if (!assetUrl) {
    throw new Error('flip_upload_invalid_response');
  }

  return assetUrl;
}

export async function createFlippedCopy(
  frontImageUrl: string,
  sessionId?: string,
): Promise<string> {
  const useMock = shouldUseFlipMock();
  if (useMock) {
    const base = getMockBase();
    const safeId = sessionId ? encodeURIComponent(sessionId) : 'anonymous';
    return `${base}/step6-back-${safeId}.png`;
  }

  const response = await fetch(frontImageUrl);
  if (!response.ok) {
    throw new Error(`Unable to download source image: ${response.status}`);
  }

  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const flippedBuffer = await sharp(sourceBuffer).flop().png().toBuffer();
  const safeId = sessionId ? encodeURIComponent(sessionId) : Date.now().toString();
  const fileName = `step6-back-${safeId}.png`;
  return uploadPngBuffer(flippedBuffer, fileName);
}
