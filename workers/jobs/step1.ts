import { Worker } from 'bullmq';

import { createComfyImage } from '../../packages/clients/comfyui';
import { redis, saveStepResult } from '../../packages/workflow/redis';
import type { Step1Payload } from '../../packages/workflow/types';

export function createStep1Worker() {
  return new Worker<Step1Payload>(
    'step1',
    async (job: import('bullmq').Job<Step1Payload>) => {
      const { sessionId, prompt } = job.data;
      const imageUrl = await createComfyImage(prompt, sessionId);
      await saveStepResult(sessionId, 'step1', { imageUrl, prompt });
      return { imageUrl };
    },
    { connection: redis },
  );
}
