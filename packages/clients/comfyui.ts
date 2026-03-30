const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';

function getMockBase() {
  return process.env.COMFYUI_MOCK_BASE_URL || DEFAULT_MOCK_BASE;
}

export async function createComfyImage(prompt: string, sessionId?: string) {
  const useMock = process.env.COMFYUI_MOCK !== '0';
  if (useMock) {
    const base = getMockBase();
    const safeId = sessionId ? encodeURIComponent(sessionId) : 'anonymous';
    return `${base}/step1-${safeId}.png`;
  }

  throw new Error(
    'ComfyUI integration not configured. Set COMFYUI_MOCK=0 only after implementing the real client.',
  );
}