type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';
const DEFAULT_API_BASE = 'https://api.ai3d.cloud.tencent.com';
const RUNNING_STATUSES = new Set(['WAIT', 'RUN']);

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

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function summarizeText(raw: string) {
  return raw.length > 260 ? `${raw.slice(0, 260)}...` : raw;
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
    const detail = text ? summarizeText(text) : 'empty response';
    throw new Error(`Tencent3D request failed (${response.status}): ${detail}`);
  }

  const payload = asObject(parsed);
  if (!payload) {
    throw new Error('Tencent3D response is not a JSON object');
  }
  return payload;
}

function extractRequestId(payload: JsonObject): string | undefined {
  return pickString(payload, [['RequestId'], ['Response', 'RequestId']]);
}

function extractTaskId(payload: JsonObject): string | undefined {
  return pickString(payload, [
    ['Response', 'JobId'],
    ['Response', 'jobId'],
    ['Response', 'taskId'],
    ['Response', 'TaskId'],
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

function extractStatus(payload: JsonObject): string | undefined {
  return pickString(payload, [
    ['Response', 'Status'],
    ['Response', 'status'],
    ['Status'],
    ['status'],
    ['data', 'status'],
    ['result', 'status'],
  ]);
}

function extractErrorCode(payload: JsonObject): string | undefined {
  const code = pickString(payload, [
    ['Response', 'ErrorCode'],
    ['Response', 'errorCode'],
    ['Response', 'Error', 'Code'],
    ['ErrorCode'],
    ['Error', 'Code'],
    ['errorCode'],
  ]);
  if (code) return code;

  const rawCode = walkPath(payload, ['Response', 'ErrorCode']) ?? walkPath(payload, ['ErrorCode']);
  if (typeof rawCode === 'number') {
    return String(rawCode);
  }
  return undefined;
}

function extractErrorMessage(payload: JsonObject): string | undefined {
  return pickString(payload, [
    ['Response', 'ErrorMessage'],
    ['Response', 'errorMessage'],
    ['Response', 'Error', 'Message'],
    ['ErrorMessage'],
    ['Error', 'Message'],
    ['errorMessage'],
    ['message'],
  ]);
}

function extractFileExt(url: string): string | undefined {
  const rawPath = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  const match = rawPath.match(/\.([a-zA-Z0-9]+)(?:$|[?#])/);
  return match?.[1]?.toLowerCase();
}

type ResultFile3D = {
  url: string;
  type?: string;
  ext?: string;
};

function pickObjectString(source: JsonObject, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    const str = asNonEmptyString(value);
    if (str) {
      return str;
    }
  }
  return undefined;
}

function extractResultFiles(payload: JsonObject): ResultFile3D[] {
  const lists: JsonValue[] = [];
  for (const path of [
    ['Response', 'ResultFile3Ds'],
    ['ResultFile3Ds'],
    ['Response', 'Result', 'ResultFile3Ds'],
    ['Result', 'ResultFile3Ds'],
    ['data', 'ResultFile3Ds'],
    ['result', 'ResultFile3Ds'],
  ]) {
    const found = walkPath(payload, path);
    if (Array.isArray(found)) {
      lists.push(found);
    }
  }

  const files: ResultFile3D[] = [];
  const seen = new Set<string>();

  for (const listValue of lists) {
    const list = listValue as JsonValue[];
    for (const item of list) {
      if (typeof item === 'string' && item.length > 0) {
        if (!seen.has(item)) {
          seen.add(item);
          files.push({ url: item, ext: extractFileExt(item) });
        }
        continue;
      }
      const obj = asObject(item);
      if (!obj) {
        continue;
      }

      const url = pickObjectString(obj, [
        'Url',
        'url',
        'FileUrl',
        'fileUrl',
        'DownloadUrl',
        'downloadUrl',
      ]);
      if (!url) {
        continue;
      }
      if (seen.has(url)) {
        continue;
      }
      seen.add(url);

      const type = pickObjectString(obj, [
        'Type',
        'type',
        'FileType',
        'fileType',
        'Format',
        'format',
      ]);
      const ext =
        pickObjectString(obj, ['Ext', 'ext', 'Suffix', 'suffix', 'FileExt', 'fileExt']) ||
        extractFileExt(url);
      files.push({ url, type, ext });
    }
  }

  return files;
}

function includesAny(source: string | undefined, values: string[]) {
  if (!source) return false;
  const lower = source.toLowerCase();
  return values.some((value) => lower.includes(value.toLowerCase()));
}

function pickByHint(files: ResultFile3D[], hints: string[]) {
  for (const file of files) {
    const hint = `${file.type || ''} ${file.ext || ''}`.trim();
    if (includesAny(hint, hints)) {
      return file.url;
    }
    if (includesAny(file.url, hints)) {
      return file.url;
    }
  }
  return undefined;
}

function extractResult(payload: JsonObject): {
  glbUrl?: string;
  objUrl?: string;
  thumbnail?: string;
} {
  const files = extractResultFiles(payload);

  const glbUrl = pickString(payload, [
    ['Response', 'GlbUrl'],
    ['Response', 'Result', 'GlbUrl'],
    ['Response', 'ModelUrl', 'GlbUrl'],
    ['Response', 'ModelUrls', 'GlbUrl'],
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
  ]) || pickByHint(files, ['glb', 'gltf']);

  const objUrl = pickString(payload, [
    ['Response', 'ObjUrl'],
    ['Response', 'Result', 'ObjUrl'],
    ['Response', 'ModelUrl', 'ObjUrl'],
    ['Response', 'ModelUrls', 'ObjUrl'],
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
  ]) || pickByHint(files, ['obj']);

  const thumbnail = pickString(payload, [
    ['Response', 'Thumbnail'],
    ['Response', 'CoverUrl'],
    ['Response', 'Result', 'Thumbnail'],
    ['Response', 'Result', 'CoverUrl'],
    ['Response', 'ModelUrl', 'Thumbnail'],
    ['Response', 'ModelUrls', 'Thumbnail'],
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
  ]) || pickByHint(files, ['png', 'jpg', 'jpeg', 'webp', 'thumbnail', 'cover']);

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
    timeoutMs: parseMillis(process.env.TENCENT3D_API_TIMEOUT_MS, 600000),
  };
}

function tencentHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: apiKey,
    'X-API-Key': apiKey,
  };
}

function logTencent(event: string, data: Record<string, unknown>) {
  try {
    console.info(`[Tencent3D] ${event} ${JSON.stringify(data)}`);
  } catch {
    console.info(`[Tencent3D] ${event}`);
  }
}

function normalizeStatus(status: string | undefined): string | undefined {
  return status?.trim().toUpperCase();
}

type SubmitMode =
  | 'text_to_3d'
  | 'single_image_to_3d'
  | 'single_plus_multiview_image_to_3d';

function sanitizeImageUrl(value: string | undefined) {
  return value && value.length > 0 ? value : undefined;
}

function getImageMode() {
  const raw = (process.env.TENCENT3D_IMAGE_MODE || 'single').toLowerCase();
  if (raw === 'text' || raw === 'single' || raw === 'multiview' || raw === 'auto') {
    return raw;
  }
  return 'single';
}

function normalizeViewType(
  raw: string | undefined,
  fallback: 'back' | 'left' | 'right' | 'top' | 'bottom' | 'left_front' | 'right_front',
) {
  const value = (raw || '').trim().toLowerCase().replace(/-/g, '_');
  if (!value) return fallback;

  if (['back', 'backview', 'rear', '后视图', '背面', '后面'].includes(value)) {
    return 'back';
  }
  if (['left', 'leftview', '左视图', '左侧'].includes(value)) {
    return 'left';
  }
  if (['right', 'rightview', '右视图', '右侧'].includes(value)) {
    return 'right';
  }
  if (['top', 'topview', '顶部', '顶视图'].includes(value)) {
    return 'top';
  }
  if (['bottom', 'bottomview', '底部', '底视图'].includes(value)) {
    return 'bottom';
  }
  if (['left_front', 'leftfront', '左前45', '左前45视图', '左前45度'].includes(value)) {
    return 'left_front';
  }
  if (['right_front', 'rightfront', '右前45', '右前45视图', '右前45度'].includes(value)) {
    return 'right_front';
  }
  return fallback;
}

function buildSubmitPayload(
  promptCn: string,
  frontImageUrl: string,
  backImageUrl: string,
): { mode: SubmitMode; imageCount: number; body: JsonObject } {
  const front = sanitizeImageUrl(frontImageUrl);
  const back = sanitizeImageUrl(backImageUrl);
  const imageMode = getImageMode();

  if (imageMode === 'text') {
    return { mode: 'text_to_3d', imageCount: 0, body: { Prompt: promptCn } };
  }

  if (imageMode === 'multiview' || (imageMode === 'auto' && front && back)) {
    if (front) {
      const supplementViewType = normalizeViewType(
        process.env.TENCENT3D_MULTI_VIEW_SUPPLEMENT_VIEW_TYPE,
        'back',
      );
      const multiViewImages =
        back && back.length > 0
          ? [{ ViewType: supplementViewType, ViewImageUrl: back }]
          : [];
      return {
        mode: 'single_plus_multiview_image_to_3d',
        imageCount: 1 + multiViewImages.length,
        body: {
          ImageUrl: front,
          ...(multiViewImages.length > 0 ? { MultiViewImages: multiViewImages } : {}),
        },
      };
    }
  }

  const singleImage = front || back;
  if (singleImage) {
    return {
      mode: 'single_image_to_3d',
      imageCount: 1,
      body: { ImageUrl: singleImage },
    };
  }

  return { mode: 'text_to_3d', imageCount: 0, body: { Prompt: promptCn } };
}

function toResponseSummary(payload: JsonObject) {
  const assets = extractResult(payload);
  const files = extractResultFiles(payload);
  return {
    requestId: extractRequestId(payload) || null,
    status: normalizeStatus(extractStatus(payload)) || null,
    jobId: extractTaskId(payload) || null,
    errorCode: extractErrorCode(payload) || null,
    errorMessage: extractErrorMessage(payload) || null,
    resultFileCount: files.length,
    glbUrl: assets.glbUrl || null,
    objUrl: assets.objUrl || null,
    thumbnail: assets.thumbnail || null,
  };
}

async function poll3DResult(config: TencentConfig, taskId: string) {
  const queryUrl = buildUrl(config.apiBaseUrl, config.queryPath);
  const deadline = Date.now() + config.timeoutMs;

  while (Date.now() < deadline) {
    const queryBody = { JobId: taskId };
    logTencent('query.request', {
      url: queryUrl,
      taskId,
      body: queryBody,
    });

    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: tencentHeaders(config.apiKey),
      body: JSON.stringify(queryBody),
    });
    const payload = await readJsonResponse(response);
    const summary = toResponseSummary(payload);
    logTencent('query.response', summary);

    const assets = extractResult(payload);
    const status = normalizeStatus(extractStatus(payload));
    if (status === 'DONE') {
      if (assets.glbUrl || assets.objUrl) {
        return assets;
      }
      throw new Error('Tencent3D task DONE but result is empty');
    }

    if (status === 'FAIL') {
      const errorCode = extractErrorCode(payload);
      const errorMessage = extractErrorMessage(payload) || 'Tencent3D task failed';
      throw new Error(
        `Tencent3D task failed${errorCode ? ` (${errorCode})` : ''}: ${errorMessage}`,
      );
    }

    if (!status && (assets.glbUrl || assets.objUrl)) {
      return assets;
    }

    if (status && !RUNNING_STATUSES.has(status)) {
      logTencent('query.waiting.unknown_status', {
        taskId,
        status,
      });
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
  const submitUrl = buildUrl(config.apiBaseUrl, config.submitPath);
  const submitPayload = buildSubmitPayload(promptCn, frontImageUrl, backImageUrl);
  const submitBody = submitPayload.body;

  logTencent('submit.request', {
    url: submitUrl,
    sessionId: sessionId || null,
    mode: submitPayload.mode,
    promptLength: promptCn.length,
    hasImage: submitPayload.imageCount > 0,
    imageCount: submitPayload.imageCount,
    body: submitBody,
  });

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: tencentHeaders(config.apiKey),
    body: JSON.stringify(submitBody),
  });

  const payload = await readJsonResponse(submitResponse);
  const summary = toResponseSummary(payload);
  logTencent('submit.response', summary);

  const submitStatus = normalizeStatus(extractStatus(payload));
  const submitErrorCode = extractErrorCode(payload);
  const submitErrorMessage = extractErrorMessage(payload);
  if (submitStatus === 'FAIL') {
    const errorCode = submitErrorCode;
    const errorMessage = submitErrorMessage || 'Tencent3D submit failed';
    throw new Error(
      `Tencent3D submit failed${errorCode ? ` (${errorCode})` : ''}: ${errorMessage}`,
    );
  }

  if (submitErrorCode || submitErrorMessage) {
    throw new Error(
      `Tencent3D submit failed${submitErrorCode ? ` (${submitErrorCode})` : ''}: ${
        submitErrorMessage || 'unknown error'
      }`,
    );
  }

  const immediateAssets = extractResult(payload);
  if (
    (submitStatus === 'DONE' || !submitStatus) &&
    (immediateAssets.glbUrl || immediateAssets.objUrl)
  ) {
    return normalizeTencentResult(immediateAssets, frontImageUrl, backImageUrl);
  }

  const taskId = extractTaskId(payload);
  if (!taskId) {
    throw new Error('Tencent3D submit response missing taskId/jobId');
  }

  const polledAssets = await poll3DResult(config, taskId);
  return normalizeTencentResult(polledAssets, frontImageUrl, backImageUrl);
}
