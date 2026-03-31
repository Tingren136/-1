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
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const step6Status = await getSessionField<string>(sessionId, 'step6Status');
  const step6 = await getSessionField(sessionId, 'step6');
  const step6Error = await getSessionField<StepError>(sessionId, 'step6Error');

  if (step6) {
    return NextResponse.json({ status: 'done', result: step6 });
  }

  if (step6Status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      error: step6Error || { message: 'step6_failed' },
    });
  }

  if (step6Status === 'running') {
    return NextResponse.json({ status: 'running' });
  }

  return NextResponse.json({ status: 'pending' });
}
