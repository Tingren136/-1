import { Queue } from 'bullmq';

import { redis } from './redis';
import type { Step1Payload, Step2Payload, Step3Payload } from './types';

export const step1Queue = new Queue<Step1Payload>('step1', {
  connection: redis,
});

export const step2Queue = new Queue<Step2Payload>('step2', {
  connection: redis,
});

export const step3Queue = new Queue<Step3Payload>('step3', {
  connection: redis,
});
