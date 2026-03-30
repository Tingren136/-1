type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';
const DEFAULT_API_BASE = 'https://api.ai3d.cloud.tencent.com';

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

function asObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonObject;
}

function walkPath(payload: JsonObject, path: string[]): JsonValue | undefined {
  let current: JsonValue | JsonObject = payload;
  for (const key of path) {
    const obj = asObject(current);
    if (!obj || !(key in obj)) {
      return undefined;
    }
    current = obj[key];
  }
  return current;
}

function pickString(payload: JsonObject, paths: string[][]): string | undefined {
  for (const path of paths) {
    const value = walkPath(payload, path);
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function buildUrl(baseUrl: string, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return `${baseUrl.replace(/\/$/, '')}${normalizePath(pathOrUrl)}`;
}

function parseMillis(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    const detail = text ? text.slice(0, 260) : 'empty response';
    throw new Error(`Tencent3D request failed (${response.status}): ${detail}`);
  }

  const payload = asObject(parsed);
  if (!payload) {
    throw new Error('Tencent3D response is not a JSON object');
  }
  return payload;
}

function extractTaskId(payload: JsonObject): string | undefined {
  return pickString(payload, [
    ['JobId'],
    ['jobID'],
    ['jobId'],
    ['taskId'],
    ['TaskId'],
    ['id'],
    ['data', 'JobId'],
    ['result', 'JobId'],
    ['data', 'jobId'],
    ['data', 'taskId'],
    ['result', 'jobId'],
    ['result', 'taskId'],
  ]);
}

function extractResult(payload: JsonObject): {
  glbUrl?: string;
  objUrl?: string;
  thumbnail?: string;
} {
  const glbUrl = pickString(payload, [
    ['GlbUrl'],
    ['ModelUrl', 'GlbUrl'],
    ['ModelUrls', 'GlbUrl'],
    ['Result', 'GlbUrl'],
    ['Result', 'ModelUrl', 'GlbUrl'],
    ['Result', 'ModelUrls', 'GlbUrl'],
    ['glbUrl'],
    ['result', 'glbUrl'],
    ['data', 'glbUrl'],
    ['data', 'result', 'glbUrl'],
    ['result', 'glb'],
    ['data', 'result', 'glb'],
  ]);

  const objUrl = pickString(payload, [
    ['ObjUrl'],
    ['ModelUrl', 'ObjUrl'],
    ['ModelUrls', 'ObjUrl'],
    ['Result', 'ObjUrl'],
    ['Result', 'ModelUrl', 'ObjUrl'],
    ['Result', 'ModelUrls', 'ObjUrl'],
    ['objUrl'],
    ['result', 'objUrl'],
    ['data', 'objUrl'],
    ['data', 'result', 'objUrl'],
    ['result', 'obj'],
    ['data', 'result', 'obj'],
  ]);

  const thumbnail = pickString(payload, [
    ['Thumbnail'],
    ['CoverUrl'],
    ['Result', 'Thumbnail'],
    ['Result', 'CoverUrl'],
    ['Result', 'ModelUrl', 'Thumbnail'],
    ['Result', 'ModelUrls', 'Thumbnail'],
    ['thumbnail'],
    ['thumb'],
    ['result', 'thumbnail'],
    ['result', 'thumb'],
    ['data', 'thumbnail'],
    ['data', 'thumb'],
    ['data', 'result', 'thumbnail'],
    ['data', 'result', 'thumb'],
  ]);

  return { glbUrl, objUrl, thumbnail };
}

type TencentConfig = {
  apiKey: string;
  apiBaseUrl: string;
  submitPath: string;
  queryPath: string;
  pollIntervalMs: number;
  timeoutMs: number;
};

function getTencentConfig(): TencentConfig {
  const apiKey = process.env.TENCENT_API_KEY;
  if (!apiKey) {
    throw new Error('Missing TENCENT_API_KEY while TENCENT3D_MOCK=0');
  }

  return {
    apiKey,
    apiBaseUrl: process.env.TENCENT3D_API_BASE_URL || DEFAULT_API_BASE,
    submitPath: process.env.TENCENT3D_API_SUBMIT_PATH || '/v1/ai3d/submit',
    queryPath: process.env.TENCENT3D_API_QUERY_PATH || '/v1/ai3d/query',
    pollIntervalMs: parseMillis(process.env.TENCENT3D_API_POLL_INTERVAL_MS, 3000),
    timeoutMs: parseMillis(process.env.TENCENT3D_API_TIMEOUT_MS, 180000),
  };
}

function tencentHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: apiKey,
    'X-API-Key': apiKey,
  };
}

async function poll3DResult(config: TencentConfig, taskId: string) {
  const queryUrl = buildUrl(config.apiBaseUrl, config.queryPath);
  const deadline = Date.now() + config.timeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: tencentHeaders(config.apiKey),
      body: JSON.stringify({
        JobId: taskId,
        jobId: taskId,
      }),
    });
    const payload = await readJsonResponse(response);

    const assets = extractResult(payload);
    if (assets.glbUrl || assets.objUrl) {
      return assets;
    }

    const status = pickString(payload, [
      ['Status'],
      ['status'],
      ['data', 'status'],
      ['result', 'status'],
    ]);
    const normalized = status?.toLowerCase();
    if (normalized && ['failed', 'error', 'cancelled'].includes(normalized)) {
      throw new Error(`Tencent3D task failed with status: ${status}`);
    }

    await sleep(config.pollIntervalMs);
  }

  throw new Error(`Tencent3D task polling timeout after ${config.timeoutMs}ms`);
}

function normalizeTencentResult(
  assets: { glbUrl?: string; objUrl?: string; thumbnail?: string },
  frontImageUrl: string,
  backImageUrl: string,
): Tencent3DResult {
  if (!assets.glbUrl && !assets.objUrl) {
    throw new Error('Tencent3D result missing glb/obj url');
  }

  return {
    glbUrl: assets.glbUrl || '',
    objUrl: assets.objUrl || '',
    thumbnail: assets.thumbnail || frontImageUrl,
    frontImageUrl,
    backImageUrl,
  };
}

export async function generateMultiViewModel(
  promptCn: string,
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

  const config = getTencentConfig();
  const submitResponse = await fetch(buildUrl(config.apiBaseUrl, config.submitPath), {
    method: 'POST',
    headers: tencentHeaders(config.apiKey),
    body: JSON.stringify({
      prompt: promptCn,
      Prompt: promptCn,
      Model: process.env.TENCENT3D_MODEL || '3.0',
      sessionId: sessionId || null,
      imageUrls: [frontImageUrl, backImageUrl],
      imageUrl: [frontImageUrl, backImageUrl],
      ImageUrl: [{ Url: frontImageUrl }, { Url: backImageUrl }],
    }),
  });

  const payload = await readJsonResponse(submitResponse);
  const immediateAssets = extractResult(payload);
  if (immediateAssets.glbUrl || immediateAssets.objUrl) {
    return normalizeTencentResult(immediateAssets, frontImageUrl, backImageUrl);
  }

  const taskId = extractTaskId(payload);
  if (!taskId) {
    throw new Error('Tencent3D submit response missing taskId/jobId');
  }

  const polledAssets = await poll3DResult(config, taskId);
  return normalizeTencentResult(polledAssets, frontImageUrl, backImageUrl);
}
