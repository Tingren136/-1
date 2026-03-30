import { NextResponse } from 'next/server';

import { buildStep1Prompt } from '@config/step1';
import { setSessionField } from '@workflow/redis';
import { step1Queue } from '@workflow/queues';
import type { Step1Input } from '@config/step1';

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = body?.sessionId as string | undefined;
  const input = body?.input as Step1Input | undefined;

  if (!sessionId || !input) {
    return NextResponse.json(
      { error: 'invalid_request' },
      { status: 400 },
    );
  }

  const prompt = buildStep1Prompt(input);
  await setSessionField(sessionId, 'currentStep', 1);

  const job = await step1Queue.add('generate', {
    sessionId,
    prompt,
    selections: input,
  });

  return NextResponse.json({ status: 'queued', jobId: job.id, prompt });
}