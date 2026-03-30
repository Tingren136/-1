import { Worker } from 'bullmq';

import { generateMultiViewModel } from '../../packages/clients/tencent3d';
import { createFlippedCopy } from '../../packages/workflow/image';
import { redis, saveStepResult } from '../../packages/workflow/redis';
import type { Step6Payload } from '../../packages/workflow/types';

export function createStep6Worker() {
  return new Worker<Step6Payload>(
    'step6',
    async (job: import('bullmq').Job<Step6Payload>) => {
      const { sessionId, promptCn, frontImageUrl } = job.data;
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
      return result;
    },
    { connection: redis },
  );
}
