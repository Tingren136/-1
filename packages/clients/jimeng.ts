type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';
const DEFAULT_API_BASE = 'https://api.jimeng.com';

function getMockBase() {
  return process.env.JIMENG_MOCK_BASE_URL || DEFAULT_MOCK_BASE;
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

function extractImageUrl(payload: JsonObject): string | undefined {
  const direct = pickString(payload, [
    ['imageUrl'],
    ['url'],
    ['result', 'imageUrl'],
    ['data', 'result', 'imageUrl'],
    ['data', 'imageUrl'],
  ]);
  if (direct) return direct;

  const images = walkPath(payload, ['images']);
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === 'string') return first;
    const firstObj = asObject(first);
    if (firstObj) {
      const img = firstObj.url;
      if (typeof img === 'string' && img.length > 0) return img;
    }
  }

  const dataImages = walkPath(payload, ['data', 'images']);
  if (Array.isArray(dataImages) && dataImages.length > 0) {
    const first = dataImages[0];
    if (typeof first === 'string') return first;
    const firstObj = asObject(first);
    if (firstObj) {
      const img = firstObj.url;
      if (typeof img === 'string' && img.length > 0) return img;
    }
  }

  return undefined;
}

function extractTaskId(payload: JsonObject): string | undefined {
  return pickString(payload, [
    ['taskId'],
    ['id'],
    ['data', 'taskId'],
    ['data', 'id'],
    ['result', 'taskId'],
  ]);
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

function queryUrl(baseUrl: string, template: string, taskId: string) {
  return buildUrl(baseUrl, template.replaceAll('{taskId}', encodeURIComponent(taskId)));
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
    throw new Error(`Jimeng request failed (${response.status}): ${detail}`);
  }

  const payload = asObject(parsed);
  if (!payload) {
    throw new Error('Jimeng response is not a JSON object');
  }
  return payload;
}

type JimengConfig = {
  apiKey: string;
  apiBaseUrl: string;
  generatePath: string;
  blendPath: string;
  queryPath: string;
  pollIntervalMs: number;
  timeoutMs: number;
};

function getJimengConfig(): JimengConfig {
  const apiKey = process.env.JIMENG_API_KEY;
  if (!apiKey) {
    throw new Error('Missing JIMENG_API_KEY while JIMENG_MOCK=0');
  }

  return {
    apiKey,
    apiBaseUrl: process.env.JIMENG_API_BASE_URL || DEFAULT_API_BASE,
    generatePath: process.env.JIMENG_API_GENERATE_PATH || '/v1/generate',
    blendPath: process.env.JIMENG_API_BLEND_PATH || '/v1/blend',
    queryPath: process.env.JIMENG_API_QUERY_PATH || '/v1/tasks/{taskId}',
    pollIntervalMs: parseMillis(process.env.JIMENG_API_POLL_INTERVAL_MS, 2500),
    timeoutMs: parseMillis(process.env.JIMENG_API_TIMEOUT_MS, 120000),
  };
}

function jimengHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
  };
}

async function pollImageByTask(config: JimengConfig, taskId: string): Promise<string> {
  const deadline = Date.now() + config.timeoutMs;
  const statusUrl = queryUrl(config.apiBaseUrl, config.queryPath, taskId);

  while (Date.now() < deadline) {
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: jimengHeaders(config.apiKey),
    });

    const payload = await readJsonResponse(response);
    const imageUrl = extractImageUrl(payload);
    if (imageUrl) {
      return imageUrl;
    }

    const status = pickString(payload, [
      ['status'],
      ['data', 'status'],
      ['result', 'status'],
    ]);
    const normalized = status?.toLowerCase();
    if (normalized && ['failed', 'error', 'cancelled'].includes(normalized)) {
      throw new Error(`Jimeng task failed with status: ${status}`);
    }

    await sleep(config.pollIntervalMs);
  }

  throw new Error(`Jimeng task polling timeout after ${config.timeoutMs}ms`);
}

async function runJimengRequest(
  config: JimengConfig,
  path: string,
  body: JsonObject,
): Promise<string> {
  const response = await fetch(buildUrl(config.apiBaseUrl, path), {
    method: 'POST',
    headers: jimengHeaders(config.apiKey),
    body: JSON.stringify(body),
  });

  const payload = await readJsonResponse(response);
  const imageUrl = extractImageUrl(payload);
  if (imageUrl) {
    return imageUrl;
  }

  const taskId = extractTaskId(payload);
  if (!taskId) {
    throw new Error('Jimeng response missing imageUrl and taskId');
  }

  return pollImageByTask(config, taskId);
}

export async function generateConceptImage(promptCn: string, sessionId?: string) {
  const useMock = process.env.JIMENG_MOCK !== '0';
  if (useMock) {
    const base = getMockBase();
    const safeId = sessionId ? encodeURIComponent(sessionId) : 'anonymous';
    return `${base}/step3-${safeId}.png`;
  }

  const config = getJimengConfig();
  return runJimengRequest(config, config.generatePath, {
    prompt: promptCn,
    sessionId: sessionId || null,
  });
}

export async function blendConceptWithPhoto(
  promptCn: string,
  conceptImageUrl: string,
  userPhotoUrl: string,
  sessionId?: string,
) {
  const useMock = process.env.JIMENG_MOCK !== '0';
  if (useMock) {
    const base = getMockBase();
    const safeId = sessionId ? encodeURIComponent(sessionId) : 'anonymous';
    return `${base}/step4-${safeId}.png`;
  }

  const config = getJimengConfig();
  return runJimengRequest(config, config.blendPath, {
    prompt: promptCn,
    conceptImageUrl,
    userPhotoUrl,
    images: [conceptImageUrl, userPhotoUrl],
    sessionId: sessionId || null,
  });
}
