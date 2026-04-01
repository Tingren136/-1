import { Worker } from 'bullmq';

import { createComfyImage } from '../../packages/clients/comfyui';
import {
  redis,
  saveStepResult,
  setSessionField,
} from '../../packages/workflow/redis';
import type { Step1Payload } from '../../packages/workflow/types';

export function createStep1Worker() {
  return new Worker<Step1Payload>(
    'step1',
    async (job: import('bullmq').Job<Step1Payload>) => {
      const { sessionId, prompt } = job.data;
      try {
        const imageUrl = await createComfyImage(prompt, sessionId);
        await saveStepResult(sessionId, 'step1', { imageUrl, prompt });
        await setSessionField(sessionId, 'step1Error', null);
        await setSessionField(sessionId, 'step1Status', 'succeeded');
        return { imageUrl };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await setSessionField(sessionId, 'step1Error', {
          message,
          at: new Date().toISOString(),
          jobId: job.id ?? null,
        });
        await setSessionField(sessionId, 'step1Status', 'failed');
        throw error;
      }
    },
    { connection: redis },
  );
}
