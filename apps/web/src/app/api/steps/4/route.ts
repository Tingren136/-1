import { NextResponse } from 'next/server';

import { getSessionField, setSessionField } from '@workflow/redis';
import { step4Queue } from '@workflow/queues';

type Step2State = { promptCn?: string };
type Step3State = { imageUrl?: string };

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = body?.sessionId as string | undefined;
  const userPhotoUrl = body?.userPhotoUrl as string | undefined;
  const providedPrompt = body?.promptCn as string | undefined;
  const providedConcept = body?.conceptImageUrl as string | undefined;

  if (!sessionId || !userPhotoUrl) {
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

  let conceptImageUrl = providedConcept;
  if (!conceptImageUrl) {
    const step3 = await getSessionField<Step3State>(sessionId, 'step3');
    conceptImageUrl = step3?.imageUrl;
  }

  if (!conceptImageUrl) {
    return NextResponse.json({ error: 'missing_step3_image' }, { status: 400 });
  }

  await setSessionField(sessionId, 'step4', null);
  await setSessionField(sessionId, 'step4Error', null);
  await setSessionField(sessionId, 'step4Status', 'running');
  await setSessionField(sessionId, 'currentStep', 4);

  const job = await step4Queue.add('blend', {
    sessionId,
    promptCn,
    conceptImageUrl,
    userPhotoUrl,
  });

  return NextResponse.json({ status: 'queued', jobId: job.id });
}
