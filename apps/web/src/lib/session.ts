import { randomUUID } from 'node:crypto';

import { createSession, getSession, setSessionField } from '@workflow/redis';

export async function initSession() {
  const sessionId = randomUUID();
  await createSession(sessionId);
  await setSessionField(sessionId, 'currentStep', 1);
  return sessionId;
}

export async function loadSession(sessionId: string) {
  return getSession(sessionId);
}