type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const DEFAULT_MOCK_BASE = 'https://example.com/mock-assets';
const DEFAULT_API_BASE = 'https://www.runninghub.cn';

function getMockBase() {
  return process.env.COMFYUI_MOCK_BASE_URL || DEFAULT_MOCK_BASE;
}

function asObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonObject;
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
    nodeId: process.env.RUNNINGHUB_NODE_ID || '64',
    fieldName: process.env.RUNNINGHUB_FIELD_NAME || 'text',
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
  return pickString(payload, [
    ['taskId'],
    ['task_id'],
    ['TaskId'],
    ['Response', 'TaskId'],
    ['data', 'taskId'],
    ['data', 'task_id'],
    ['data', 'TaskId'],
    ['Response', 'Data', 'TaskId'],
    ['result', 'taskId'],
    ['result', 'task_id'],
    ['result', 'TaskId'],
    ['data', 'result', 'taskId'],
    ['data', 'result', 'task_id'],
    ['data', 'result', 'TaskId'],
  ]);
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

  const requestNodeInfoList = requestBody.nodeInfoList;
  if (!Array.isArray(requestNodeInfoList) || requestNodeInfoList.length === 0) {
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
  const immediateUrl = pickResultUrl(payload);
  if (immediateUrl) {
    return immediateUrl;
  }

  const taskId = pickTaskId(payload);
  if (!taskId) {
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
    const keys = Object.keys(payload).join(',');
    throw new Error(
      `RunningHub submit response missing taskId/results (status=${status || 'unknown'}, code=${errorCode || 'unknown'}, message=${errorMessage || 'unknown'}, keys=${keys || 'none'})`,
    );
  }

  return pollRunningHub(config, taskId);
}
