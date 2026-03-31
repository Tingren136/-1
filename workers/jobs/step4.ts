import { Worker } from 'bullmq';

import { blendConceptWithPhoto } from '../../packages/clients/jimeng';
import { redis, saveStepResult, setSessionField } from '../../packages/workflow/redis';
import type { Step4Payload } from '../../packages/workflow/types';

export function createStep4Worker() {
  return new Worker<Step4Payload>(
    'step4',
    async (job: import('bullmq').Job<Step4Payload>) => {
      const { sessionId, promptCn, conceptImageUrl, userPhotoUrl } = job.data;
      try {
        const imageUrl = await blendConceptWithPhoto(
          promptCn,
          conceptImageUrl,
          userPhotoUrl,
          sessionId,
        );
        const result = {
          imageUrl,
          promptCn,
          conceptImageUrl,
          userPhotoUrl,
        };
        await saveStepResult(sessionId, 'step4', result);
        await setSessionField(sessionId, 'step4Error', null);
        await setSessionField(sessionId, 'step4Status', 'succeeded');
        return { imageUrl };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await setSessionField(sessionId, 'step4Error', {
          message,
          at: new Date().toISOString(),
          jobId: job.id ?? null,
        });
        await setSessionField(sessionId, 'step4Status', 'failed');
        throw error;
      }
    },
    { connection: redis },
  );
}
