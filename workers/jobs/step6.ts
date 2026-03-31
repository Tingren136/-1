import { Worker } from 'bullmq';

import { generateMultiViewModel } from '../../packages/clients/tencent3d';
import { createFlippedCopy } from '../../packages/workflow/image';
import { redis, saveStepResult, setSessionField } from '../../packages/workflow/redis';
import type { Step6Payload } from '../../packages/workflow/types';

export function createStep6Worker() {
  return new Worker<Step6Payload>(
    'step6',
    async (job: import('bullmq').Job<Step6Payload>) => {
      const { sessionId, promptCn, frontImageUrl } = job.data;
      try {
        const backImageUrl =
          job.data.backImageUrl ||
          (await createFlippedCopy(frontImageUrl, sessionId));

        const result = await generateMultiViewModel(
          promptCn,
          frontImageUrl,
          backImageUrl,
          sessionId,
        );

        await saveStepResult(sessionId, 'step6', result);
        await setSessionField(sessionId, 'step6Error', null);
        await setSessionField(sessionId, 'step6Status', 'succeeded');
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await setSessionField(sessionId, 'step6Error', {
          message,
          at: new Date().toISOString(),
          jobId: job.id ?? null,
        });
        await setSessionField(sessionId, 'step6Status', 'failed');
        throw error;
      }
    },
    { connection: redis },
  );
}
