import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const DEFAULT_MOCK_ANALYSIS = '这是一双带有清晰线条的鞋履概念草图，整体结构紧凑，适合进一步生成概念图。';
const DEFAULT_MOCK_PROMPT = '简洁利落的鞋履设计，比例匀称，材质细节清晰，白色背景，单一主体。';
const DEFAULT_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_PROMPT_FILE = '.local/step2-agent-prompt.txt';

type GeminiConfig = {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
};

class HttpStatusError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

type DownloadedImage = {
  mimeType: string;
  dataBase64: string;
};

export type GeminiResult = {
  analysisCn: string;
  promptCn: string;
};

export type DescribeShoeOptions = {
  step1Prompt?: string;
};

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

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function parseNonNegativeInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function normalizeApiBaseUrl(raw: string | undefined) {
  const base = raw || DEFAULT_API_BASE;
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function getGeminiConfig(): GeminiConfig {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY while GEMINI_MOCK=0');
  }

  return {
    apiKey,
    apiBaseUrl: normalizeApiBaseUrl(process.env.GEMINI_API_BASE_URL),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timeoutMs: parsePositiveInt(process.env.GEMINI_TIMEOUT_MS, 45000),
    maxRetries: parseNonNegativeInt(process.env.GEMINI_MAX_RETRIES, 2),
    retryDelayMs: parsePositiveInt(process.env.GEMINI_RETRY_DELAY_MS, 1200),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Gemini request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonObject(response: Response, errorPrefix: string): Promise<JsonObject> {
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
    throw new HttpStatusError(response.status, `${errorPrefix} (${response.status}): ${detail}`);
  }

  const payload = asObject(parsed);
  if (!payload) {
    throw new Error('Gemini response is not a JSON object');
  }
  return payload;
}

function detectMimeType(url: string, contentType: string | null): string {
  const fromHeader = contentType?.split(';')[0]?.trim().toLowerCase();
  if (fromHeader && fromHeader.startsWith('image/')) {
    return fromHeader;
  }

  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();

  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

async function downloadImage(imageUrl: string, config: GeminiConfig): Promise<DownloadedImage> {
  const response = await fetchWithTimeout(
    imageUrl,
    {
      method: 'GET',
    },
    config.timeoutMs,
  );

  if (!response.ok) {
    const body = await response.text();
    const detail = body ? body.slice(0, 200) : 'empty response';
    throw new HttpStatusError(
      response.status,
      `Gemini image download failed (${response.status}): ${detail}`,
    );
  }

  const mimeType = detectMimeType(imageUrl, response.headers.get('content-type'));
  const bytes = await response.arrayBuffer();
  const dataBase64 = Buffer.from(bytes).toString('base64');
  if (!dataBase64) {
    throw new Error('Gemini image download returned empty payload');
  }

  return { mimeType, dataBase64 };
}

function extractCandidateText(payload: JsonObject): string | undefined {
  const candidates = walkPath(payload, ['candidates']);
  if (!Array.isArray(candidates)) {
    return undefined;
  }

  for (const candidateValue of candidates) {
    const candidate = asObject(candidateValue);
    if (!candidate) continue;
    const parts = walkPath(candidate, ['content', 'parts']);
    if (!Array.isArray(parts)) continue;

    for (const partValue of parts) {
      const part = asObject(partValue);
      if (!part) continue;
      const text = part.text;
      if (typeof text === 'string' && text.trim().length > 0) {
        return text;
      }
    }
  }

  return undefined;
}

function parseResultFromText(text: string): GeminiResult {
  const direct = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  })();

  const parsed = asObject(direct);
  if (parsed) {
    const analysisCn = parsed.analysisCn;
    const promptCn = parsed.promptCn;
    if (
      typeof analysisCn === 'string' &&
      analysisCn.trim().length > 0 &&
      typeof promptCn === 'string' &&
      promptCn.trim().length > 0
    ) {
      return {
        analysisCn: analysisCn.trim(),
        promptCn: promptCn.trim(),
      };
    }
  }

  const jsonFragment = text.match(/\{[\s\S]*\}/)?.[0];
  if (jsonFragment) {
    try {
      const fragmentParsed = JSON.parse(jsonFragment);
      const obj = asObject(fragmentParsed);
      if (
        obj &&
        typeof obj.analysisCn === 'string' &&
        obj.analysisCn.trim().length > 0 &&
        typeof obj.promptCn === 'string' &&
        obj.promptCn.trim().length > 0
      ) {
        return {
          analysisCn: obj.analysisCn.trim(),
          promptCn: obj.promptCn.trim(),
        };
      }
    } catch {
      // Continue throwing a descriptive error below.
    }
  }

  throw new Error(`Gemini response text cannot be parsed as GeminiResult: ${text.slice(0, 180)}`);
}

function isTransientError(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

async function runWithRetries<T>(task: () => Promise<T>, config: GeminiConfig): Promise<T> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const canRetry = attempt < config.maxRetries && isTransientError(error);
      if (!canRetry) {
        throw error;
      }
      const delay = config.retryDelayMs * 2 ** attempt;
      await sleep(delay);
    }
  }

  throw new Error('Gemini retry flow reached unreachable branch');
}

function applyTemplate(
  template: string,
  values: {
    accessoryTag: string;
    step1Prompt: string;
  },
) {
  return template
    .replaceAll('{{accessoryTag}}', values.accessoryTag)
    .replaceAll('{accessoryTag}', values.accessoryTag)
    .replaceAll('{{step1Prompt}}', values.step1Prompt)
    .replaceAll('{step1Prompt}', values.step1Prompt);
}

function appendJsonOutputContract(prompt: string): string {
  return [
    prompt.trim(),
    '',
    '【系统强制输出格式】',
    '你必须只输出严格 JSON，不允许输出 Markdown，不允许输出额外说明。',
    'JSON 结构固定为：{"analysisCn":"...","promptCn":"..."}。',
    'analysisCn 与 promptCn 必须为非空中文字符串。',
  ].join('\n');
}

function resolvePromptTemplate(): string | undefined {
  const inline = process.env.GEMINI_PROMPT_TEMPLATE?.trim();
  if (inline) {
    return inline;
  }

  const candidates = [process.env.GEMINI_PROMPT_FILE?.trim(), resolve(process.cwd(), DEFAULT_PROMPT_FILE)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!existsSync(candidate)) continue;
    const content = readFileSync(candidate, 'utf8').trim();
    if (content) {
      return content;
    }
  }

  return undefined;
}

function buildPrompt(accessoryTag: string, step1Prompt?: string): string {
  const safeAccessory = accessoryTag?.trim() || '无';
  const safeStep1Prompt = step1Prompt?.trim() || '无';

  const customTemplate = resolvePromptTemplate();
  if (customTemplate) {
    return appendJsonOutputContract(
      applyTemplate(customTemplate, {
        accessoryTag: safeAccessory,
        step1Prompt: safeStep1Prompt,
      }),
    );
  }

  return appendJsonOutputContract([
    '你是资深鞋履视觉提示词工程师。',
    '请先充分理解输入鞋履图，再输出结果。',
    `当前饰品类型：${safeAccessory}。`,
    `Step1 原始英文提示词：${safeStep1Prompt}。`,
    '要求与原鞋款在鞋型、比例、主材质上保持一致，不要替换主体品类。',
    '请只返回严格 JSON，不要 Markdown，不要额外解释。',
    'JSON 结构必须是：{"analysisCn":"...","promptCn":"..."}。',
    'analysisCn：2-3 句中文，描述鞋型、材质、线条和风格要点。',
    'promptCn：用于图像生成的中文提示词，强调横版构图、主体完整、材质细节、布光和纯净背景。',
  ].join('\n'));
}

async function requestGemini(
  image: DownloadedImage,
  accessoryTag: string,
  config: GeminiConfig,
  options?: DescribeShoeOptions,
): Promise<GeminiResult> {
  const url = `${config.apiBaseUrl}/models/${encodeURIComponent(config.model)}:generateContent`;
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildPrompt(accessoryTag, options?.step1Prompt) },
              {
                inline_data: {
                  mime_type: image.mimeType,
                  data: image.dataBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    },
    config.timeoutMs,
  );

  const payload = await readJsonObject(response, 'Gemini request failed');
  const candidateText = extractCandidateText(payload);
  if (!candidateText) {
    throw new Error('Gemini response missing candidate text');
  }
  return parseResultFromText(candidateText);
}

export async function describeShoe(
  imageUrl: string,
  accessoryTag: string,
  options?: DescribeShoeOptions,
): Promise<GeminiResult> {
  const useMock = process.env.GEMINI_MOCK !== '0';
  if (useMock) {
    const tag = accessoryTag ? `，饰品为${accessoryTag}` : '';
    return {
      analysisCn: `${DEFAULT_MOCK_ANALYSIS}${tag}`,
      promptCn: `${DEFAULT_MOCK_PROMPT}${tag}`,
    };
  }

  const config = getGeminiConfig();
  const image = await downloadImage(imageUrl, config);
  return runWithRetries(() => requestGemini(image, accessoryTag, config, options), config);
}
