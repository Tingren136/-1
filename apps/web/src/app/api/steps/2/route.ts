import { NextResponse } from 'next/server';

import { getSessionField, setSessionField } from '@workflow/redis';
import { step2Queue } from '@workflow/queues';

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = body?.sessionId as string | undefined;
  const accessoryTag = body?.accessoryTag as string | undefined;
  const providedImageUrl = body?.step1ImageUrl as string | undefined;

  if (!sessionId || !accessoryTag) {
    return NextResponse.json(
      { error: 'invalid_request' },
      { status: 400 },
    );
  }

  let step1ImageUrl = providedImageUrl;
  let step1Prompt: string | undefined;
  if (!step1ImageUrl) {
    const step1 = await getSessionField<{ imageUrl?: string; prompt?: string }>(
      sessionId,
      'step1',
    );
    step1ImageUrl = step1?.imageUrl;
    step1Prompt = step1?.prompt;
  }

  if (!step1Prompt) {
    const step1 = await getSessionField<{ prompt?: string }>(sessionId, 'step1');
    step1Prompt = step1?.prompt;
  }

  if (!step1ImageUrl) {
    return NextResponse.json(
      { error: 'missing_step1_image' },
      { status: 400 },
    );
  }

  await setSessionField(sessionId, 'step2', null);
  await setSessionField(sessionId, 'step2Error', null);
  await setSessionField(sessionId, 'step2Status', 'running');
  await setSessionField(sessionId, 'currentStep', 2);

  const job = await step2Queue.add('generate', {
    sessionId,
    step1ImageUrl,
    accessoryTag,
    step1Prompt,
  });

  return NextResponse.json({ status: 'queued', jobId: job.id });
}
