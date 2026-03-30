const DEFAULT_MOCK_ANALYSIS = '这是一双带有清晰线条的鞋履概念草图，整体结构紧凑，适合进一步生成概念图。';
const DEFAULT_MOCK_PROMPT = '简洁利落的鞋履设计，比例匀称，材质细节清晰，白色背景，单一主体。';

export type GeminiResult = {
  analysisCn: string;
  promptCn: string;
};

export async function describeShoe(
  imageUrl: string,
  accessoryTag: string,
): Promise<GeminiResult> {
  const useMock = process.env.GEMINI_MOCK !== '0';
  if (useMock) {
    const tag = accessoryTag ? `，饰品为${accessoryTag}` : '';
    return {
      analysisCn: `${DEFAULT_MOCK_ANALYSIS}${tag}`,
      promptCn: `${DEFAULT_MOCK_PROMPT}${tag}`,
    };
  }

  throw new Error(
    'Gemini integration not configured. Set GEMINI_MOCK=0 only after implementing the real client.',
  );
}