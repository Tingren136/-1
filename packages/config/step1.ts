import step1Config from '../../config/step1-material-config.json';

export type ShoeShape = {
  id: string;
  label: string;
  phrase: string;
};

export type Material = {
  id: string;
  label: string;
  base: string;
  finish?: string;
  defaultColorMode?: string;
};

export type Texture = {
  id: string;
  label: string;
  phrase: string;
};

type KnownColorKeys = {
  single?: string;
  primary?: string;
  secondary?: string;
  colorA?: string;
  colorB?: string;
};

export type ColorSelection = Record<string, string> & KnownColorKeys;

export type Step1Input = {
  shoeShapeId: string;
  materialId: string;
  textureIds: string[];
  colorSelection?: ColorSelection;
  customColorPhrase?: string;
};

export type Step1MaterialConfig = typeof step1Config;

export const getShoeShapes = (): readonly ShoeShape[] => step1Config.shoeShapes;
export const getMaterials = (): readonly Material[] => step1Config.materials;
export const getTextures = (): readonly Texture[] => step1Config.textures;
export const getColorTemplates = (): Step1MaterialConfig['colorTemplates'] =>
  step1Config.colorTemplates;

const COLOR_PLACEHOLDER_REGEX = /\{(single|primary|secondary|colorA|colorB)\}/g;

function extractPlaceholders(template: string): Set<keyof ColorSelection> {
  const matches = template.match(COLOR_PLACEHOLDER_REGEX) ?? [];
  return new Set(
    matches.map(
      (match) => match.slice(1, -1) as keyof ColorSelection, // strip { }
    ),
  );
}

function fillTemplate(template: string, colors: ColorSelection): string {
  return template.replace(
    COLOR_PLACEHOLDER_REGEX,
    (_, key: keyof ColorSelection) => colors[key] ?? '',
  );
}

function buildColorPhrase(
  material: Material | undefined,
  input: Step1Input,
): string {
  if (input.customColorPhrase) return input.customColorPhrase;
  if (!material) return '';

  const modeFromFinish = material.finish as
    | keyof Step1MaterialConfig['colorTemplates']
    | undefined;

  const modeFromDefault = material.defaultColorMode as
    | keyof Step1MaterialConfig['colorTemplates']
    | undefined;

  const resolvedMode =
    (modeFromFinish && step1Config.colorTemplates[modeFromFinish]
      ? modeFromFinish
      : undefined) ??
    (modeFromDefault && step1Config.colorTemplates[modeFromDefault]
      ? modeFromDefault
      : undefined);

  if (!resolvedMode) return '';

  const templates = step1Config.colorTemplates[resolvedMode];
  const colors = input.colorSelection ?? {};

  const usableTemplate = templates.find((template) => {
    const requiredPlaceholders = extractPlaceholders(template);
    return [...requiredPlaceholders].every(
      (placeholder) => colors[placeholder],
    );
  });

  return usableTemplate ? fillTemplate(usableTemplate, colors).trim() : '';
}

export function buildStep1Prompt(input: Step1Input) {
  const parts: string[] = [];
  const material = step1Config.materials.find(
    (candidate) => candidate.id === input.materialId,
  );
  const shape = step1Config.shoeShapes.find(
    (candidate) => candidate.id === input.shoeShapeId,
  );
  const textures = input.textureIds
    .map(
      (id) => step1Config.textures.find((texture) => texture.id === id)?.phrase,
    )
    .filter(Boolean) as string[];

  for (const token of step1Config.promptOrder) {
    if (token === 'prefix') {
      parts.push(step1Config.prefix);
    } else if (token === 'shoeShape') {
      parts.push(shape?.phrase ?? '');
    } else if (token === 'materialBase') {
      parts.push(material?.base ?? '');
    } else if (token === 'texture') {
      parts.push(...textures);
    } else if (token === 'color') {
      parts.push(buildColorPhrase(material, input));
    } else if (token === 'background') {
      parts.push(...step1Config.background);
    }
  }

  return parts.filter(Boolean).join(', ');
}
