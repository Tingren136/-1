import { afterEach, describe, expect, it, vi } from 'vitest';

import { describeShoe } from '../../packages/clients/gemini';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe('gemini real client', () => {
  afterEach(() => {
    restoreEnv();
    globalThis.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
  });

  it('throws when GEMINI_MOCK=0 but GEMINI_API_KEY is missing', async () => {
    process.env.GEMINI_MOCK = '0';
    delete process.env.GEMINI_API_KEY;

    await expect(describeShoe('https://example.com/step1.png', '项链')).rejects.toThrow(
      'Missing GEMINI_API_KEY while GEMINI_MOCK=0',
    );
  });

  it('downloads image and parses JSON result from Gemini generateContent', async () => {
    process.env.GEMINI_MOCK = '0';
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    process.env.GEMINI_RETRY_DELAY_MS = '1';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"analysisCn":"结构分析","promptCn":"中文提示词"}' }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await describeShoe('https://example.com/step1.png', '项链');
    expect(result).toEqual({
      analysisCn: '结构分析',
      promptCn: '中文提示词',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const geminiCall = fetchMock.mock.calls[1];
    const requestUrl = String(geminiCall[0]);
    const requestInit = geminiCall[1] as RequestInit;
    const requestHeaders = requestInit.headers as Record<string, string>;
    const requestBody = JSON.parse(String(requestInit.body));

    expect(requestUrl).toContain('/models/gemini-2.5-flash:generateContent');
    expect(requestHeaders['X-Goog-Api-Key']).toBe('gemini-key');
    expect(requestBody.contents[0].parts[1].inline_data.mime_type).toBe('image/png');
    expect(requestBody.contents[0].parts[1].inline_data.data.length).toBeGreaterThan(0);
  });

  it('retries transient Gemini errors then succeeds', async () => {
    process.env.GEMINI_MOCK = '0';
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GEMINI_RETRY_DELAY_MS = '1';
    process.env.GEMINI_MAX_RETRIES = '2';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(Uint8Array.from([9, 8, 7]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('busy', {
          status: 503,
          headers: { 'content-type': 'text/plain' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"analysisCn":"重试成功","promptCn":"最终提示词"}' }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await describeShoe('https://example.com/step1.png', '耳环');
    expect(result.promptCn).toBe('最终提示词');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('supports custom prompt template with placeholders', async () => {
    process.env.GEMINI_MOCK = '0';
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GEMINI_PROMPT_TEMPLATE =
      '饰品={{accessoryTag}}\\n原始提示={step1Prompt}\\n只输出JSON';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"analysisCn":"分析","promptCn":"提示"}' }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as typeof fetch;

    await describeShoe('https://example.com/step1.png', '项链', {
      step1Prompt: 'shoe prompt',
    });

    const requestBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(requestBody.contents[0].parts[0].text).toContain('饰品=项链');
    expect(requestBody.contents[0].parts[0].text).toContain('原始提示=shoe prompt');
  });
});
