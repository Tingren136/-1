import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';
const DEFAULT_API_BASE = 'https://www.runninghub.cn';

function getMockBase() {
  return process.env.COMFYUI_MOCK_BASE_URL || DEFAULT_MOCK_BASE;
}

function tryParseJsonObject(raw: string): JsonObject | undefined {
  const text = raw.trim();
  if (!text.startsWith('{') || !text.endsWith('}')) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function asObject(value: unknown): JsonObject | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  if (typeof value === 'string') {
    return tryParseJsonObject(value);
  }
  return undefined;
}

function pickString(payload: JsonObject, paths: string[][]): string | undefined {
  for (const path of paths) {
    let current: JsonValue | JsonObject = payload;
    let matched = true;
    for (const key of path) {
      const obj = asObject(current);
      if (!obj || !(key in obj)) {
        matched = false;
        break;
      }
      current = obj[key];
    }
    if (!matched) continue;
    if (typeof current === 'string' && current.length > 0) {
      return current;
    }
    if (typeof current === 'number' && Number.isFinite(current)) {
      return String(current);
    }
  }
  return undefined;
}

function pickResultUrl(payload: JsonObject): string | undefined {
  const direct = pickString(payload, [
    ['url'],
    ['result', 'url'],
    ['data', 'url'],
    ['data', 'result', 'url'],
  ]);
  if (direct) return direct;

  const candidateArrays: unknown[] = [
    payload.results,
    asObject(payload.data)?.results,
    asObject(payload.result)?.results,
    asObject(asObject(payload.data)?.result)?.results,
  ];

  for (const results of candidateArrays) {
    if (!Array.isArray(results) || results.length === 0) continue;
    const first = results[0];
    if (typeof first === 'string') return first;
    const firstObj = asObject(first);
    if (!firstObj) continue;
    const url = firstObj.url;
    if (typeof url === 'string' && url.length > 0) {
      return url;
    }
  }
  return undefined;
}

function parseMillis(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toTaskIdCandidate(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.trim();
  if (!text || /\s/.test(text)) {
    return undefined;
  }
  if (/^https?:\/\//i.test(text)) {
    return undefined;
  }
  if (['success', 'ok', 'true', 'false'].includes(text.toLowerCase())) {
    return undefined;
  }
  return text;
}

function toCaptureJson(value: JsonValue | JsonObject, depth = 0): JsonValue {
  if (depth >= 6) return '[max-depth]';
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > 4000 ? `${value.slice(0, 4000)}...(truncated)` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 50) {
      return [
        ...value.slice(0, 50).map((item) => toCaptureJson(item as JsonValue, depth + 1)),
        `...(truncated ${value.length - 50} items)`,
      ] as unknown as JsonValue;
    }
    return value.map((item) => toCaptureJson(item as JsonValue, depth + 1)) as unknown as JsonValue;
  }
  const obj = value as JsonObject;
  const entries = Object.entries(obj);
  const limitedEntries = entries.slice(0, 80);
  const out: Record<string, JsonValue> = {};
  for (const [key, val] of limitedEntries) {
    out[key] = toCaptureJson(val, depth + 1);
  }
  if (entries.length > limitedEntries.length) {
    out.__truncatedKeys = `...(truncated ${entries.length - limitedEntries.length} keys)`;
  }
  return out;
}

function captureRunningHubSubmit(payload: JsonObject, meta: Record<string, unknown>) {
  if (process.env.RUNNINGHUB_CAPTURE_SUBMIT !== '1') {
    return;
  }
  try {
    const dir = join(process.cwd(), 'logs');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'runninghub-submit-samples.ndjson');
    const line = JSON.stringify({
      at: new Date().toISOString(),
      event: 'runninghub_submit_response',
      ...meta,
      payload: toCaptureJson(payload),
    });
    appendFileSync(file, `${line}\n`, 'utf8');
  } catch {
    // Best effort capture only; never block workflow.
  }
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
    throw new Error(`RunningHub request failed (${response.status}): ${detail}`);
  }

  const payload = asObject(parsed);
  if (!payload) {
    throw new Error('RunningHub response is not a JSON object');
  }

  return payload;
}

type RunningHubConfig = {
  apiKey: string;
  apiBaseUrl: string;
  appId: string;
  nodeId: string;
  fieldName: string;
  instanceType: string;
  usePersonalQueue: boolean;
  runMode: 'ai-app' | 'workflow';
  addMetadata: boolean;
  retainSeconds?: number;
  pollIntervalMs: number;
  timeoutMs: number;
};

function parseBoolean(raw: string | undefined, fallback: boolean) {
  if (raw == null || raw === '') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseRunMode(raw: string | undefined): 'ai-app' | 'workflow' {
  return raw?.trim().toLowerCase() === 'workflow' ? 'workflow' : 'ai-app';
}

function getRunningHubConfig(): RunningHubConfig {
  const apiKey = process.env.RUNNINGHUB_API_KEY || process.env.COMFY_API_KEY;
  const appId = process.env.RUNNINGHUB_APP_ID;

  if (!apiKey) {
    throw new Error('Missing RUNNINGHUB_API_KEY/COMFY_API_KEY while COMFYUI_MOCK=0');
  }
  if (!appId) {
    throw new Error('Missing RUNNINGHUB_APP_ID while COMFYUI_MOCK=0');
  }

  const retainParsed = Number(process.env.RUNNINGHUB_RETAIN_SECONDS);
  const runMode = parseRunMode(process.env.RUNNINGHUB_RUN_MODE);

  return {
    apiKey,
    apiBaseUrl: process.env.RUNNINGHUB_API_BASE_URL || DEFAULT_API_BASE,
    appId,
    nodeId:
      process.env.RUNNINGHUB_NODE_ID ||
      (runMode === 'workflow' ? '' : '64'),
    fieldName:
      process.env.RUNNINGHUB_FIELD_NAME ||
      (runMode === 'workflow' ? '' : 'text'),
    instanceType: process.env.RUNNINGHUB_INSTANCE_TYPE || 'default',
    usePersonalQueue: parseBoolean(process.env.RUNNINGHUB_USE_PERSONAL_QUEUE, false),
    runMode,
    addMetadata: parseBoolean(process.env.RUNNINGHUB_ADD_METADATA, runMode === 'workflow'),
    retainSeconds:
      Number.isFinite(retainParsed) && retainParsed > 0 ? retainParsed : undefined,
    pollIntervalMs: parseMillis(process.env.RUNNINGHUB_POLL_INTERVAL_MS, 2500),
    timeoutMs: parseMillis(process.env.RUNNINGHUB_TIMEOUT_MS, 180000),
  };
}

function apiUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function pickTaskId(payload: JsonObject): string | undefined {
  const direct = pickString(payload, [
    ['taskId'],
    ['task_id'],
    ['TaskId'],
    ['jobId'],
    ['jobID'],
    ['JobId'],
    ['id'],
    ['Response', 'TaskId'],
    ['Response', 'taskId'],
    ['Response', 'JobId'],
    ['Response', 'jobId'],
    ['Response', 'Data', 'jobId'],
    ['data', 'taskId'],
    ['data', 'task_id'],
    ['data', 'TaskId'],
    ['data', 'jobId'],
    ['data', 'jobID'],
    ['data', 'JobId'],
    ['data', 'id'],
    ['Response', 'Data', 'TaskId'],
    ['Response', 'Data', 'taskId'],
    ['result', 'taskId'],
    ['result', 'task_id'],
    ['result', 'TaskId'],
    ['result', 'jobId'],
    ['result', 'JobId'],
    ['result', 'id'],
    ['data', 'result', 'taskId'],
    ['data', 'result', 'task_id'],
    ['data', 'result', 'TaskId'],
    ['data', 'result', 'jobId'],
    ['data', 'result', 'JobId'],
    ['data', 'result', 'id'],
    ['data'],
    ['result'],
    ['Response', 'Data'],
    ['Response', 'Result'],
  ]);
  if (direct) {
    return direct;
  }

  const scalarFallbacks: unknown[] = [
    payload.data,
    payload.result,
    asObject(payload.Response)?.Data,
    asObject(payload.Response)?.Result,
  ];
  for (const candidate of scalarFallbacks) {
    const taskId = toTaskIdCandidate(candidate);
    if (taskId) {
      return taskId;
    }
  }
  return undefined;
}

function isErrorCodeLikeFailure(code: string | undefined): boolean {
  if (!code) return false;
  const normalized = code.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === '0' || normalized === 'success' || normalized === 'ok') {
    return false;
  }
  return true;
}

async function pollRunningHub(config: RunningHubConfig, taskId: string): Promise<string> {
  const deadline = Date.now() + config.timeoutMs;
  const queryUrl = apiUrl(config.apiBaseUrl, '/openapi/v2/query');

  while (Date.now() < deadline) {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ taskId }),
    });

    const payload = await readJsonResponse(response);
    const status =
      pickString(payload, [
        ['status'],
        ['Status'],
        ['data', 'status'],
        ['data', 'Status'],
        ['Response', 'Status'],
      ])?.toUpperCase();
    const imageUrl = pickResultUrl(payload);

    if (status === 'SUCCESS' && imageUrl) {
      return imageUrl;
    }

    if (status === 'FAILED') {
      const errorMessage =
        pickString(payload, [['errorMessage'], ['failedReason', 'message']]) ||
        'RunningHub task failed';
      throw new Error(errorMessage);
    }

    await sleep(config.pollIntervalMs);
  }

  throw new Error(`RunningHub polling timeout after ${config.timeoutMs}ms`);
}

export async function createComfyImage(prompt: string, sessionId?: string) {
  const useMock = process.env.COMFYUI_MOCK !== '0';
  if (useMock) {
    const base = getMockBase();
    const safeId = sessionId ? encodeURIComponent(sessionId) : 'anonymous';
    return `${base}/step1-${safeId}.png`;
  }

  const config = getRunningHubConfig();
  const runUrl = apiUrl(
    config.apiBaseUrl,
    `/openapi/v2/run/${config.runMode === 'workflow' ? 'workflow' : 'ai-app'}/${encodeURIComponent(config.appId)}`,
  );

  const nodeInfoList: JsonObject[] = [];
  if (config.nodeId && config.fieldName) {
    nodeInfoList.push({
      nodeId: config.nodeId,
      fieldName: config.fieldName,
      fieldValue: prompt,
      description: config.fieldName,
    });
  }

  const requestBody: JsonObject = {
    nodeInfoList,
    instanceType: config.instanceType,
    usePersonalQueue: config.usePersonalQueue,
  };

  if (config.addMetadata) {
    requestBody.addMetadata = true;
  }

  const requestNodeInfoList = Array.isArray(requestBody.nodeInfoList)
    ? requestBody.nodeInfoList
    : [];
  if (
    config.runMode === 'ai-app' &&
    (!Array.isArray(requestNodeInfoList) || requestNodeInfoList.length === 0)
  ) {
    throw new Error('RunningHub request validation failed: nodeInfoList is empty');
  }

  // Do not log apiKey; only print critical request fields for debugging prompt wiring.
  console.info('[step1][runninghub-submit]', {
    url: runUrl,
    appId: config.appId,
    runMode: config.runMode,
    nodeInfoListCount: requestNodeInfoList.length,
    nodeId: config.nodeId,
    fieldName: config.fieldName,
    instanceType: config.instanceType,
    usePersonalQueue: config.usePersonalQueue,
    promptPreview: prompt.slice(0, 140),
  });

  if (typeof config.retainSeconds === 'number') {
    requestBody.retainSeconds = config.retainSeconds;
  }

  const response = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const payload = await readJsonResponse(response);
  captureRunningHubSubmit(payload, {
    sessionId: sessionId || null,
    httpStatus: response.status,
    runUrl,
    runMode: config.runMode,
  });
  const immediateUrl = pickResultUrl(payload);
  if (immediateUrl) {
    return immediateUrl;
  }

  const taskId = pickTaskId(payload);
  const status = pickString(payload, [
    ['status'],
    ['Status'],
    ['data', 'status'],
    ['data', 'Status'],
    ['Response', 'Status'],
  ]);
  const errorCode = pickString(payload, [
    ['errorCode'],
    ['ErrorCode'],
    ['code'],
    ['Code'],
    ['data', 'errorCode'],
    ['data', 'ErrorCode'],
    ['Response', 'Error', 'Code'],
  ]);
  const errorMessage = pickString(payload, [
    ['errorMessage'],
    ['ErrorMessage'],
    ['message'],
    ['Message'],
    ['msg'],
    ['data', 'errorMessage'],
    ['data', 'message'],
    ['Response', 'Error', 'Message'],
  ]);

  const normalizedStatus = status?.trim().toUpperCase();
  const submitFailedByStatus = normalizedStatus === 'FAIL' || normalizedStatus === 'FAILED';
  const submitFailedByCode = isErrorCodeLikeFailure(errorCode);

  if (!taskId && (submitFailedByStatus || submitFailedByCode) && errorMessage) {
    throw new Error(
      `RunningHub submit failed${errorCode ? ` (${errorCode})` : ''}: ${errorMessage}`,
    );
  }

  if (!taskId) {
    const keys = Object.keys(payload).join(',');
    throw new Error(
      `RunningHub submit response missing taskId/results (status=${status || 'unknown'}, code=${errorCode || 'unknown'}, message=${errorMessage || 'unknown'}, keys=${keys || 'none'})`,
    );
  }

  return pollRunningHub(config, taskId);
}
