import { Worker } from 'bullmq';

import { generateConceptImage } from '../../packages/clients/jimeng';
import { redis, saveStepResult, setSessionField } from '../../packages/workflow/redis';
import type { Step3Payload } from '../../packages/workflow/types';

export function createStep3Worker() {
  return new Worker<Step3Payload>(
    'step3',
    async (job: import('bullmq').Job<Step3Payload>) => {
      const { sessionId, promptCn } = job.data;
      try {
        const imageUrl = await generateConceptImage(promptCn, sessionId);
        await saveStepResult(sessionId, 'step3', { imageUrl, promptCn });
        await setSessionField(sessionId, 'step3Error', null);
        await setSessionField(sessionId, 'step3Status', 'succeeded');
        return { imageUrl };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await setSessionField(sessionId, 'step3Error', {
          message,
          at: new Date().toISOString(),
          jobId: job.id ?? null,
        });
        await setSessionField(sessionId, 'step3Status', 'failed');
        throw error;
      }
    },
    { connection: redis },
  );
}

