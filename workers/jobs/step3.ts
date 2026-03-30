import { Worker } from 'bullmq';

import { generateConceptImage } from '../../packages/clients/jimeng';
import { redis, saveStepResult } from '../../packages/workflow/redis';
import type { Step3Payload } from '../../packages/workflow/types';

export function createStep3Worker() {
  return new Worker<Step3Payload>(
    'step3',
    async (job: import('bullmq').Job<Step3Payload>) => {
      const { sessionId, promptCn } = job.data;
      const imageUrl = await generateConceptImage(promptCn, sessionId);
      await saveStepResult(sessionId, 'step3', { imageUrl, promptCn });
      return { imageUrl };
    },
    { connection: redis },
  );
}
