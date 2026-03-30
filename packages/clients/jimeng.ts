const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';

function getMockBase() {
  return process.env.JIMENG_MOCK_BASE_URL || DEFAULT_MOCK_BASE;
}

export async function generateConceptImage(promptCn: string, sessionId?: string) {
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