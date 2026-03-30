import sharp from 'sharp';

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';

function getMockBase() {
  return process.env.OBJECT_STORAGE_PUBLIC_BASE_URL || DEFAULT_MOCK_BASE;
}

export async function createFlippedCopy(
  frontImageUrl: string,
  sessionId?: string,
): Promise<string> {
  const useMock = process.env.IMAGE_FLIP_MOCK !== '0';
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

  // Real object storage upload is not implemented in this phase.
  void flippedBuffer;
  throw new Error('Real upload for flipped image is not implemented yet.');
}
