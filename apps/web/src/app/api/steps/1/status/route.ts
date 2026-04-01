import { NextResponse } from 'next/server';

import { getSessionField } from '@workflow/redis';

type StepError = {
  message?: string;
  at?: string;
  jobId?: string | number | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json(
      { error: 'invalid_request' },
      { status: 400 },
    );
  }

  const step1Status = await getSessionField<string>(sessionId, 'step1Status');
  const step1 = await getSessionField(sessionId, 'step1');
  const step1Error = await getSessionField<StepError>(sessionId, 'step1Error');

  if (step1) {
    return NextResponse.json({ status: 'done', result: step1 });
  }

  if (step1Status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      error: step1Error || { message: 'step1_failed' },
    });
  }

  if (step1Status === 'running') {
    return NextResponse.json({ status: 'running' });
  }

  return NextResponse.json({ status: 'pending' });
}
