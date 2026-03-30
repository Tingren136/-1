const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';

function getMockBase() {
  return process.env.JIMENG_MOCK_BASE_URL || DEFAULT_MOCK_BASE;
}

export async function generateConceptImage(_promptCn: string, sessionId?: string) {
  const useMock = process.env.JIMENG_MOCK !== '0';
  if (useMock) {
    const base = getMockBase();
    const safeId = sessionId ? encodeURIComponent(sessionId) : 'anonymous';
    return `${base}/step3-${safeId}.png`;
  }

  throw new Error(
    'Jimeng integration not configured. Set JIMENG_MOCK=0 only after implementing the real client.',
  );
}

export async function blendConceptWithPhoto(
  _promptCn: string,
  _conceptImageUrl: string,
  _userPhotoUrl: string,
  sessionId?: string,
) {
  const useMock = process.env.JIMENG_MOCK !== '0';
  if (useMock) {
    const base = getMockBase();
    const safeId = sessionId ? encodeURIComponent(sessionId) : 'anonymous';
    return `${base}/step4-${safeId}.png`;
  }

  throw new Error(
    'Jimeng blend integration not configured. Set JIMENG_MOCK=0 only after implementing the real client.',
  );
}
