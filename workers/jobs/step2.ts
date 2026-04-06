import { Worker } from 'bullmq';

import { describeShoe } from '../../packages/clients/gemini';
import { redis, saveStepResult, setSessionField } from '../../packages/workflow/redis';
import type { Step2Payload } from '../../packages/workflow/types';

export function createStep2Worker() {
  return new Worker<Step2Payload>(
    'step2',
    async (job: import('bullmq').Job<Step2Payload>) => {
      const { sessionId, step1ImageUrl, accessoryTag, step1Prompt } = job.data;
      try {
        const generated = await describeShoe(step1ImageUrl, accessoryTag, {
          step1Prompt,
        });
        const result = {
          ...generated,
          accessoryTag,
        };
        await saveStepResult(sessionId, 'step2', result);
        await setSessionField(sessionId, 'step2Error', null);
        await setSessionField(sessionId, 'step2Status', 'succeeded');
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await setSessionField(sessionId, 'step2Error', {
          message,
          at: new Date().toISOString(),
          jobId: job.id ?? null,
        });
        await setSessionField(sessionId, 'step2Status', 'failed');
        throw error;
      }
    },
    { connection: redis },
  );
}
