const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';

export type Tencent3DResult = {
  glbUrl: string;
  objUrl: string;
  thumbnail: string;
  frontImageUrl: string;
  backImageUrl: string;
};

function getMockBase() {
  return process.env.TENCENT3D_MOCK_BASE_URL || DEFAULT_MOCK_BASE;
}

export async function generateMultiViewModel(
  _promptCn: string,
  frontImageUrl: string,
  backImageUrl: string,
  sessionId?: string,
): Promise<Tencent3DResult> {
  const useMock = process.env.TENCENT3D_MOCK !== '0';
  if (useMock) {
    const base = getMockBase();
    const safeId = sessionId ? encodeURIComponent(sessionId) : 'anonymous';
    return {
      glbUrl: `${base}/step6-${safeId}.glb`,
      objUrl: `${base}/step6-${safeId}.obj`,
      thumbnail: `${base}/step6-${safeId}.png`,
      frontImageUrl,
      backImageUrl,
    };
  }

  throw new Error(
    'Tencent 3D integration not configured. Set TENCENT3D_MOCK=0 only after implementing the real client.',
  );
}
