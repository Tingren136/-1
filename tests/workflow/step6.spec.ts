import { describe, expect, it } from 'vitest';

import { pickStep6FrontImage } from '../../packages/workflow/step6';

describe('pickStep6FrontImage', () => {
  it('优先使用请求显式传入的 frontImageUrl', () => {
    const picked = pickStep6FrontImage({
      providedFrontImage: ' https://example.com/from-request.png ',
      step3: { imageUrl: 'https://example.com/from-step3.png' },
      step4: { imageUrl: 'https://example.com/from-step4.png' },
      preferenceRaw: 'step3',
    });

    expect(picked.frontImageUrl).toBe('https://example.com/from-request.png');
    expect(picked.source).toBe('request');
  });

  it('默认优先 step3，再回退 step4', () => {
    const picked = pickStep6FrontImage({
      step3: { imageUrl: 'https://example.com/from-step3.png' },
      step4: { imageUrl: 'https://example.com/from-step4.png' },
    });

    expect(picked.frontImageUrl).toBe('https://example.com/from-step3.png');
    expect(picked.source).toBe('step3');
  });

  it('当 STEP6_FRONT_SOURCE=step4 时优先 step4', () => {
    const picked = pickStep6FrontImage({
      step3: { imageUrl: 'https://example.com/from-step3.png' },
      step4: { imageUrl: 'https://example.com/from-step4.png' },
      preferenceRaw: 'step4',
    });

    expect(picked.frontImageUrl).toBe('https://example.com/from-step4.png');
    expect(picked.source).toBe('step4');
  });
});
