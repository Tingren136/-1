import { afterEach, describe, expect, it, vi } from 'vitest';

import { createComfyImage } from '../../packages/clients/comfyui';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe('runninghub real response parsing', () => {
  afterEach(() => {
    restoreEnv();
    globalThis.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
  });

  it('accepts taskId from stringified data object', async () => {
    process.env.COMFYUI_MOCK = '0';
    process.env.RUNNINGHUB_API_KEY = 'demo-key';
    process.env.RUNNINGHUB_APP_ID = 'app-1';
    process.env.RUNNINGHUB_POLL_INTERVAL_MS = '1';
    process.env.RUNNINGHUB_TIMEOUT_MS = '2000';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: '{"taskId":"task-from-json-string"}',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'SUCCESS',
            data: {
              results: [{ url: 'https://example.com/step1-stringified.png' }],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const imageUrl = await createComfyImage('demo prompt', 's-1');
    expect(imageUrl).toBe('https://example.com/step1-stringified.png');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accepts taskId when submit data itself is task id string', async () => {
    process.env.COMFYUI_MOCK = '0';
    process.env.RUNNINGHUB_API_KEY = 'demo-key';
    process.env.RUNNINGHUB_APP_ID = 'app-2';
    process.env.RUNNINGHUB_POLL_INTERVAL_MS = '1';
    process.env.RUNNINGHUB_TIMEOUT_MS = '2000';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: 'task-direct-string',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { status: 'SUCCESS', results: [{ url: 'https://example.com/step1-direct.png' }] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const imageUrl = await createComfyImage('demo prompt', 's-2');
    expect(imageUrl).toBe('https://example.com/step1-direct.png');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws submit failed when submit returns errorCode/errorMessage without taskId', async () => {
    process.env.COMFYUI_MOCK = '0';
    process.env.RUNNINGHUB_API_KEY = 'demo-key';
    process.env.RUNNINGHUB_APP_ID = 'app-3';

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          taskId: '',
          status: '',
          errorCode: '1',
          errorMessage: 'Unknown error, please retry or contact support',
          results: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    globalThis.fetch = fetchMock as typeof fetch;

    await expect(createComfyImage('demo prompt', 's-3')).rejects.toThrow(
      'RunningHub submit failed (1): Unknown error, please retry or contact support',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses empty nodeInfoList by default in workflow mode', async () => {
    process.env.COMFYUI_MOCK = '0';
    process.env.RUNNINGHUB_API_KEY = 'demo-key';
    process.env.RUNNINGHUB_APP_ID = 'wf-app-1';
    process.env.RUNNINGHUB_RUN_MODE = 'workflow';
    process.env.RUNNINGHUB_POLL_INTERVAL_MS = '1';
    process.env.RUNNINGHUB_TIMEOUT_MS = '2000';
    delete process.env.RUNNINGHUB_NODE_ID;
    delete process.env.RUNNINGHUB_FIELD_NAME;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            taskId: 'workflow-task-1',
            status: 'RUNNING',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'SUCCESS',
            results: [{ url: 'https://example.com/step1-workflow.png' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const imageUrl = await createComfyImage('demo prompt', 's-4');
    expect(imageUrl).toBe('https://example.com/step1-workflow.png');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const submitBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(submitBody.nodeInfoList).toEqual([]);
  });
});
