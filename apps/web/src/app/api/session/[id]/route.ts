import { NextResponse } from 'next/server';

import { getSession } from '@workflow/redis';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const state = await getSession(params.id);
  if (!Object.keys(state).length) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ sessionId: params.id, state });
}