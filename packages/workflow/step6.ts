type ImageState = { imageUrl?: string };

export type Step6FrontSource = 'request' | 'step3' | 'step4';
type Step6FrontPreference = 'step3' | 'step4';

function normalizeImageUrl(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseFrontPreference(raw: string | undefined): Step6FrontPreference {
  const value = (raw || '').trim().toLowerCase();
  return value === 'step4' ? 'step4' : 'step3';
}

export function pickStep6FrontImage(input: {
  providedFrontImage?: string;
  step3?: ImageState | null;
  step4?: ImageState | null;
  preferenceRaw?: string;
}): { frontImageUrl?: string; source?: Step6FrontSource } {
  const fromRequest = normalizeImageUrl(input.providedFrontImage);
  if (fromRequest) {
    return { frontImageUrl: fromRequest, source: 'request' };
  }

  const step3Image = normalizeImageUrl(input.step3?.imageUrl);
  const step4Image = normalizeImageUrl(input.step4?.imageUrl);
  const preference = parseFrontPreference(input.preferenceRaw);

  if (preference === 'step4') {
    if (step4Image) return { frontImageUrl: step4Image, source: 'step4' };
    if (step3Image) return { frontImageUrl: step3Image, source: 'step3' };
    return {};
  }

  if (step3Image) return { frontImageUrl: step3Image, source: 'step3' };
  if (step4Image) return { frontImageUrl: step4Image, source: 'step4' };
  return {};
}
