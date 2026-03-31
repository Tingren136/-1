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

  const step4Status = await getSessionField<string>(sessionId, 'step4Status');
  const step4 = await getSessionField(sessionId, 'step4');
  const step4Error = await getSessionField<StepError>(sessionId, 'step4Error');

  if (step4) {
    return NextResponse.json({ status: 'done', result: step4 });
  }

  if (step4Status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      error: step4Error || { message: 'step4_failed' },
    });
  }

  if (step4Status === 'running') {
    return NextResponse.json({ status: 'running' });
  }

  return NextResponse.json({ status: 'pending' });
}
