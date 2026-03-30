import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { createSession, setSessionField } from '@workflow/redis';

export async function POST() {
  const sessionId = randomUUID();
  await createSession(sessionId);
  await setSessionField(sessionId, 'currentStep', 1);
  return NextResponse.json({ sessionId });
}