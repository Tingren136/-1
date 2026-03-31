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

  const step2Status = await getSessionField<string>(sessionId, 'step2Status');
  const step2 = await getSessionField(sessionId, 'step2');
  const step2Error = await getSessionField<StepError>(sessionId, 'step2Error');

  if (step2) {
    return NextResponse.json({ status: 'done', result: step2 });
  }

  if (step2Status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      error: step2Error || { message: 'step2_failed' },
    });
  }

  if (step2Status === 'running') {
    return NextResponse.json({ status: 'running' });
  }

  return NextResponse.json({ status: 'pending' });
}
