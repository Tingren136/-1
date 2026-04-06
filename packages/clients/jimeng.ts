import sharp from 'sharp';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';
const DEFAULT_API_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_BLEND_ASPECT_RATIO = 4 / 3;
const DEFAULT_BLEND_LONG_EDGE = 1536;
const DEFAULT_BLEND_MIN_PIXELS = 3686400;
const DEFAULT_IMAGE_FETCH_RETRIES = 3;
const DEFAULT_IMAGE_FETCH_RETRY_DELAY_MS = 800;
const DEFAULT_EMBED_MAX_BYTES = 15 * 1024 * 1024;

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

  const dataList = walkPath(payload, ['data']);
  if (Array.isArray(dataList) && dataList.length > 0) {
    const first = dataList[0];
    if (typeof first === 'string') return first;
    const firstObj = asObject(first);
    if (firstObj) {
      const url = firstObj.url;
      if (typeof url === 'string' && url.length > 0) return url;
    }
  }

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

function shouldEmbedInputImages() {
  return process.env.JIMENG_EMBED_INPUT_IMAGES !== '0';
}

function parseAspectRatio(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim();
  if (!normalized) return undefined;
  if (normalized.includes(':')) {
    const [w, h] = normalized.split(':', 2).map((item) => Number(item));
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return w / h;
    }
    return undefined;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToMultiple(value: number, base: number) {
  return Math.max(base, Math.round(value / base) * base);
}

function ceilToMultiple(value: number, base: number) {
  return Math.max(base, Math.ceil(value / base) * base);
}

function normalizeAccessoryLabel(accessoryTag?: string) {
  const normalized = accessoryTag?.trim();
  if (normalized?.includes('项链')) return '项链';
  if (normalized?.includes('手环')) return '手环';
  if (normalized?.includes('耳环')) return '耳环';
  return '首饰';
}

export function buildBlendPrompt(_promptCn: string, accessoryTag?: string) {
  const accessoryLabel = normalizeAccessoryLabel(accessoryTag);
  return `给图一的女生，带上图二的${accessoryLabel}，然后首饰要细小一点。`;
}

export async function inferImageAspectRatioFromUrl(imageUrl: string): Promise<number | undefined> {
  try {
    const response = await fetch(imageUrl, { method: 'GET' });
    if (!response.ok) return undefined;
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height || metadata.height <= 0) {
      return undefined;
    }
    return metadata.width / metadata.height;
  } catch {
    return undefined;
  }
}

export function resolveBlendSizing(aspectRatio?: number) {
  const envAspectRatio = parseAspectRatio(process.env.JIMENG_BLEND_ASPECT_RATIO);
  const normalizedAspectRatio = clamp(
    aspectRatio ?? envAspectRatio ?? DEFAULT_BLEND_ASPECT_RATIO,
    0.5,
    2,
  );

  const envLongEdge = Number(process.env.JIMENG_BLEND_LONG_EDGE);
  const longEdge = clamp(
    Number.isFinite(envLongEdge) && envLongEdge > 0 ? Math.round(envLongEdge) : DEFAULT_BLEND_LONG_EDGE,
    1024,
    4096,
  );
  const envMinPixels = Number(process.env.JIMENG_BLEND_MIN_PIXELS);
  const minPixels = clamp(
    Number.isFinite(envMinPixels) && envMinPixels > 0
      ? Math.round(envMinPixels)
      : DEFAULT_BLEND_MIN_PIXELS,
    1024 * 1024,
    4096 * 4096,
  );

  let baseWidth = longEdge;
  let baseHeight = longEdge;
  if (normalizedAspectRatio >= 1) {
    baseWidth = longEdge;
    baseHeight = Math.round(longEdge / normalizedAspectRatio);
  } else {
    baseHeight = longEdge;
    baseWidth = Math.round(longEdge * normalizedAspectRatio);
  }

  const basePixels = baseWidth * baseHeight;
  const targetPixels = Math.max(minPixels, basePixels);

  let width: number;
  let height: number;
  if (normalizedAspectRatio >= 1) {
    width = Math.sqrt(targetPixels * normalizedAspectRatio);
    height = width / normalizedAspectRatio;
  } else {
    height = Math.sqrt(targetPixels / normalizedAspectRatio);
    width = height * normalizedAspectRatio;
  }

  width = clamp(ceilToMultiple(width, 64), 512, 4096);
  height = clamp(ceilToMultiple(height, 64), 512, 4096);
  if (width * height < minPixels) {
    if (normalizedAspectRatio >= 1) {
      width = clamp(ceilToMultiple(Math.sqrt(minPixels * normalizedAspectRatio), 64), 512, 4096);
      height = clamp(ceilToMultiple(width / normalizedAspectRatio, 64), 512, 4096);
    } else {
      height = clamp(ceilToMultiple(Math.sqrt(minPixels / normalizedAspectRatio), 64), 512, 4096);
      width = clamp(ceilToMultiple(height * normalizedAspectRatio, 64), 512, 4096);
    }
  }
  return {
    aspectRatio: normalizedAspectRatio,
    size: `${width}x${height}`,
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const retries = parseMillis(
    process.env.JIMENG_IMAGE_FETCH_RETRIES,
    DEFAULT_IMAGE_FETCH_RETRIES,
  );
  const retryDelayMs = parseMillis(
    process.env.JIMENG_IMAGE_FETCH_RETRY_DELAY_MS,
    DEFAULT_IMAGE_FETCH_RETRY_DELAY_MS,
  );
  const maxBytes = parseMillis(
    process.env.JIMENG_EMBED_MAX_BYTES,
    DEFAULT_EMBED_MAX_BYTES,
  );

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`fetch_image_failed (${response.status})`);
      }
      const contentType = response.headers.get('content-type') || 'image/png';
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxBytes) {
        throw new Error(`image_too_large_for_embed (${buffer.length} > ${maxBytes})`);
      }
      return `data:${contentType.split(';')[0]};base64,${buffer.toString('base64')}`;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`embed_input_image_failed: ${detail}`);
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
    generatePath: process.env.JIMENG_API_GENERATE_PATH || '/images/generations',
    blendPath: process.env.JIMENG_API_BLEND_PATH || '/images/generations',
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
    model: process.env.JIMENG_MODEL || 'doubao-seedream-5-0-260128',
    prompt: promptCn,
    size: process.env.JIMENG_IMAGE_SIZE || '2K',
    response_format: process.env.JIMENG_RESPONSE_FORMAT || 'url',
    extra_body: {
      watermark: process.env.JIMENG_WATERMARK !== '0',
    },
    sessionId: sessionId || null,
  });
}

export async function blendConceptWithPhoto(
  promptCn: string,
  conceptImageUrl: string,
  userPhotoUrl: string,
  sessionId?: string,
  accessoryTag?: string,
  userPhotoAspectRatio?: number,
) {
  const useMock = process.env.JIMENG_MOCK !== '0';
  if (useMock) {
    const base = getMockBase();
    const safeId = sessionId ? encodeURIComponent(sessionId) : 'anonymous';
    return `${base}/step4-${safeId}.png`;
  }

  const config = getJimengConfig();
  const sizing = resolveBlendSizing(userPhotoAspectRatio);
  let image1 = userPhotoUrl;
  let image2 = conceptImageUrl;
  if (shouldEmbedInputImages()) {
    try {
      const [embeddedUser, embeddedConcept] = await Promise.all([
        fetchImageAsDataUrl(userPhotoUrl),
        fetchImageAsDataUrl(conceptImageUrl),
      ]);
      image1 = embeddedUser;
      image2 = embeddedConcept;
    } catch {
      image1 = userPhotoUrl;
      image2 = conceptImageUrl;
    }
  }
  return runJimengRequest(config, config.blendPath, {
    model: process.env.JIMENG_MODEL || 'doubao-seedream-5-0-260128',
    prompt: buildBlendPrompt(promptCn, accessoryTag),
    // Use official i2i field from Ark docs: image[0]=person, image[1]=jewelry reference.
    image: [image1, image2],
    sequential_image_generation:
      process.env.JIMENG_SEQUENTIAL_IMAGE_GENERATION || 'disabled',
    output_format: process.env.JIMENG_OUTPUT_FORMAT || 'png',
    watermark: process.env.JIMENG_WATERMARK === '0' ? false : true,
    // Keep legacy fields for compatibility with previous adapters.
    conceptImageUrl,
    userPhotoUrl,
    size: process.env.JIMENG_BLEND_SIZE || sizing.size,
    sessionId: sessionId || null,
  });
}
