import { describe, expect, it, vi, beforeEach } from 'vitest';

const getSessionFieldMock = vi.fn();

vi.mock('@workflow/redis', () => ({
  getSessionField: getSessionFieldMock,
}));

describe('step3 status route', () => {
  beforeEach(() => {
    getSessionFieldMock.mockReset();
  });

  it('returns failed when step3Status is failed and step3Error exists', async () => {
    getSessionFieldMock.mockImplementation(async (_sessionId: string, field: string) => {
      if (field === 'step3Status') return 'failed';
      if (field === 'step3') return undefined;
      if (field === 'step3Error') return { message: 'fetch failed' };
      return undefined;
    });

    const { GET } = await import(
      '../../apps/web/src/app/api/steps/3/status/route'
    );
    const response = await GET(
      new Request('http://localhost/api/steps/3/status?sessionId=s-1'),
    );
    const json = await response.json();

    expect(json.status).toBe('failed');
    expect(json.error).toEqual({ message: 'fetch failed' });
  });
});

