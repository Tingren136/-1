import { describe, expect, it } from 'vitest';

import { createComfyImage } from '../../packages/clients/comfyui';
import { describeShoe } from '../../packages/clients/gemini';
import { blendConceptWithPhoto, generateConceptImage } from '../../packages/clients/jimeng';
import { generateMultiViewModel } from '../../packages/clients/tencent3d';

describe('mock clients', () => {
  it('returns deterministic mock urls for ComfyUI and Jimeng', async () => {
    const step1Url = await createComfyImage('demo prompt', 's-1');
    const step3Url = await generateConceptImage('中文提示词', 's-1');
    const step4Url = await blendConceptWithPhoto(
      '中文提示词',
      'https://example.com/concept.png',
      'https://example.com/user.png',
      's-1',
    );

    expect(step1Url).toContain('step1-s-1.png');
    expect(step3Url).toContain('step3-s-1.png');
    expect(step4Url).toContain('step4-s-1.png');
  });

  it('returns structured mock result for Gemini and Tencent3D', async () => {
    const step2 = await describeShoe('https://example.com/step1.png', '项链');
    const step6 = await generateMultiViewModel(
      step2.promptCn,
      'https://example.com/front.png',
      'https://example.com/back.png',
      's-1',
    );

    expect(step2.analysisCn).toContain('饰品为项链');
    expect(step2.promptCn).toContain('饰品为项链');
    expect(step6.glbUrl).toContain('step6-s-1.glb');
    expect(step6.objUrl).toContain('step6-s-1.obj');
    expect(step6.thumbnail).toContain('step6-s-1.png');
    expect(step6.frontImageUrl).toContain('front.png');
    expect(step6.backImageUrl).toContain('back.png');
  });
});
