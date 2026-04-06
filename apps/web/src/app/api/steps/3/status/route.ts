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

  const step3Status = await getSessionField<string>(sessionId, 'step3Status');
  const step3 = await getSessionField(sessionId, 'step3');
  const step3Error = await getSessionField<StepError>(sessionId, 'step3Error');

  if (step3) {
    return NextResponse.json({ status: 'done', result: step3 });
  }

  if (step3Status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      error: step3Error || { message: 'step3_failed' },
    });
  }

  if (step3Status === 'running') {
    return NextResponse.json({ status: 'running' });
  }

  return NextResponse.json({ status: 'pending' });
}

