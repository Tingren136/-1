import { Worker } from 'bullmq';

import { describeShoe } from '../../packages/clients/gemini';
import { redis, saveStepResult } from '../../packages/workflow/redis';
import type { Step2Payload } from '../../packages/workflow/types';

export function createStep2Worker() {
  return new Worker<Step2Payload>(
    'step2',
    async (job: import('bullmq').Job<Step2Payload>) => {
      const { sessionId, step1ImageUrl, accessoryTag } = job.data;
      const result = await describeShoe(step1ImageUrl, accessoryTag);
      await saveStepResult(sessionId, 'step2', result);
      return result;
    },
    { connection: redis },
  );
}
