import { describe, expect, it } from 'vitest';

import { buildStep1Prompt } from '../../packages/config/step1';

describe('buildStep1Prompt', () => {
  it('assembles prompt in configured order with single color mode', () => {
    const prompt = buildStep1Prompt({
      shoeShapeId: 'pointed',
      materialId: 'wood_plain',
      textureIds: ['smooth'],
      colorSelection: { single: 'jade green' },
    });

    expect(prompt).toContain('msh_stylet');
    expect(prompt).toContain('featuring pointed toe design');
    expect(prompt).toContain('made of wood');
    expect(prompt).toContain('presenting a smooth, polished surface');
    expect(prompt).toContain('in natural jade green tones');
    expect(prompt).toContain('white background');
    expect(prompt).toContain('single object');
  });

  it('prefers custom color phrase when provided', () => {
    const prompt = buildStep1Prompt({
      shoeShapeId: 'pointed',
      materialId: 'wood_plain',
      textureIds: ['smooth'],
      colorSelection: { single: 'jade green' },
      customColorPhrase: 'a handpicked warm orange palette',
    });

    expect(prompt).toContain('a handpicked warm orange palette');
    expect(prompt).not.toContain('in natural jade green tones');
  });

  it('maps pair colors to glaze placeholders for ceramic material', () => {
    const prompt = buildStep1Prompt({
      shoeShapeId: 'pointed',
      materialId: 'ceramic_glaze',
      textureIds: ['smooth'],
      colorSelection: { primary: 'jade green', secondary: 'olive' },
    });

    expect(prompt).toContain('made of ceramic');
    expect(prompt).toContain('featuring a jade green-olive glazed gradient');
  });
});
