import { NextResponse } from 'next/server';

import { getSession } from '@workflow/redis';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const state = await getSession(resolved.id);
  if (!Object.keys(state).length) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ sessionId: resolved.id, state });
}
