import { createStep1Worker } from './jobs/step1';
import { createStep2Worker } from './jobs/step2';
import { createStep3Worker } from './jobs/step3';

createStep1Worker();
createStep2Worker();
createStep3Worker();