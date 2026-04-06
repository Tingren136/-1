import { afterEach, describe, expect, it, vi } from 'vitest';

import { blendConceptWithPhoto, generateConceptImage } from '../../packages/clients/jimeng';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe('jimeng real client', () => {
  afterEach(() => {
    restoreEnv();
    globalThis.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
  });

  it('uses /images/generations as default blend endpoint and sends generation payload', async () => {
    process.env.JIMENG_MOCK = '0';
    process.env.JIMENG_API_KEY = 'jimeng-key';
    process.env.JIMENG_API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
    delete process.env.JIMENG_API_BLEND_PATH;
    process.env.JIMENG_MODEL = 'doubao-seedream-5-0-260128';
    process.env.JIMENG_IMAGE_SIZE = '2K';
    process.env.JIMENG_RESPONSE_FORMAT = 'url';
    process.env.JIMENG_WATERMARK = '1';
    process.env.JIMENG_EMBED_INPUT_IMAGES = '0';

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ url: 'https://example.com/step4-real.png' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const imageUrl = await blendConceptWithPhoto(
      '融合提示词',
      'https://example.com/concept.png',
      'https://example.com/user.png',
      's-1',
      '项链',
      4 / 3,
    );

    expect(imageUrl).toBe('https://example.com/step4-real.png');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((requestInit as RequestInit).body));

    expect(String(requestUrl)).toBe(
      'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    );
    expect(body).toMatchObject({
      model: 'doubao-seedream-5-0-260128',
      image: ['https://example.com/user.png', 'https://example.com/concept.png'],
      sequential_image_generation: 'disabled',
      size: '2240x1664',
      output_format: 'png',
      watermark: true,
    });
    expect(body.prompt).toBe('给图一的女生，带上图二的项链，然后首饰要细小一点。');
    expect(body.prompt).toContain('首饰要细小一点');
  });

  it('keeps step3 generation behavior unchanged', async () => {
    process.env.JIMENG_MOCK = '0';
    process.env.JIMENG_API_KEY = 'jimeng-key';
    process.env.JIMENG_API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
    process.env.JIMENG_MODEL = 'doubao-seedream-5-0-260128';

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ url: 'https://example.com/step3-real.png' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const imageUrl = await generateConceptImage('概念图提示词', 's-2');
    expect(imageUrl).toBe('https://example.com/step3-real.png');

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((requestInit as RequestInit).body));
    expect(String(requestUrl)).toBe(
      'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    );
    expect(body.prompt).toBe('概念图提示词');
    expect(body.model).toBe('doubao-seedream-5-0-260128');
  });
});
