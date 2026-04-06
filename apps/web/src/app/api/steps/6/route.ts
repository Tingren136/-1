import { NextResponse } from 'next/server';

import { getSessionField, setSessionField } from '@workflow/redis';
import { step6Queue } from '@workflow/queues';
import { pickStep6FrontImage } from '@workflow/step6';

type Step2State = { promptCn?: string };
type ImageState = { imageUrl?: string };

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = body?.sessionId as string | undefined;
  const providedPrompt = body?.promptCn as string | undefined;
  const providedFrontImage = body?.frontImageUrl as string | undefined;
  const backImageUrl = body?.backImageUrl as string | undefined;

  if (!sessionId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let promptCn = providedPrompt;
  if (!promptCn) {
    const step2 = await getSessionField<Step2State>(sessionId, 'step2');
    promptCn = step2?.promptCn;
  }

  if (!promptCn) {
    return NextResponse.json({ error: 'missing_step2_prompt' }, { status: 400 });
  }

  const [step3, step4] = await Promise.all([
    getSessionField<ImageState>(sessionId, 'step3'),
    getSessionField<ImageState>(sessionId, 'step4'),
  ]);
  const { frontImageUrl, source: frontImageSource } = pickStep6FrontImage({
    providedFrontImage,
    step3,
    step4,
    preferenceRaw: process.env.STEP6_FRONT_SOURCE,
  });

  if (!frontImageUrl) {
    return NextResponse.json(
      { error: 'missing_step3_or_step4_image' },
      { status: 400 },
    );
  }

  await setSessionField(sessionId, 'step6', null);
  await setSessionField(sessionId, 'step6Error', null);
  await setSessionField(sessionId, 'step6Status', 'running');
  await setSessionField(sessionId, 'step6InputSource', frontImageSource || 'unknown');
  await setSessionField(sessionId, 'currentStep', 6);

  const job = await step6Queue.add('build-3d', {
    sessionId,
    promptCn,
    frontImageUrl,
    backImageUrl,
  });

  return NextResponse.json({ status: 'queued', jobId: job.id });
}
