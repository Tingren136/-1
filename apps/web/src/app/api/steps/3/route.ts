import { NextResponse } from 'next/server';

import { getSessionField, setSessionField } from '@workflow/redis';
import { step3Queue } from '@workflow/queues';

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = body?.sessionId as string | undefined;
  const providedPrompt = body?.promptCn as string | undefined;

  if (!sessionId) {
    return NextResponse.json(
      { error: 'invalid_request' },
      { status: 400 },
    );
  }

  let promptCn = providedPrompt;
  if (!promptCn) {
    const step2 = await getSessionField<{ promptCn?: string }>(sessionId, 'step2');
    promptCn = step2?.promptCn;
  }

  if (!promptCn) {
    return NextResponse.json(
      { error: 'missing_step2_prompt' },
      { status: 400 },
    );
  }

  await setSessionField(sessionId, 'step3', null);
  await setSessionField(sessionId, 'step3Error', null);
  await setSessionField(sessionId, 'step3Status', 'running');
  await setSessionField(sessionId, 'currentStep', 3);

  const job = await step3Queue.add('generate', {
    sessionId,
    promptCn,
  });

  return NextResponse.json({ status: 'queued', jobId: job.id });
}
