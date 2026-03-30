import { NextResponse } from 'next/server';

import { getSessionField } from '@workflow/redis';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json(
      { error: 'invalid_request' },
      { status: 400 },
    );
  }

  const step1 = await getSessionField(sessionId, 'step1');
  if (!step1) {
    return NextResponse.json({ status: 'pending' });
  }
  return NextResponse.json({ status: 'done', result: step1 });
}