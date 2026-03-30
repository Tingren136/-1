import { Worker } from 'bullmq';

import { blendConceptWithPhoto } from '../../packages/clients/jimeng';
import { redis, saveStepResult } from '../../packages/workflow/redis';
import type { Step4Payload } from '../../packages/workflow/types';

export function createStep4Worker() {
  return new Worker<Step4Payload>(
    'step4',
    async (job: import('bullmq').Job<Step4Payload>) => {
      const { sessionId, promptCn, conceptImageUrl, userPhotoUrl } = job.data;
      const imageUrl = await blendConceptWithPhoto(
        promptCn,
        conceptImageUrl,
        userPhotoUrl,
        sessionId,
      );
      await saveStepResult(sessionId, 'step4', {
        imageUrl,
        promptCn,
        conceptImageUrl,
        userPhotoUrl,
      });
      return { imageUrl };
    },
    { connection: redis },
  );
}
