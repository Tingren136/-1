import { createStep1Worker } from './jobs/step1';
import { createStep2Worker } from './jobs/step2';
import { createStep3Worker } from './jobs/step3';
import { createStep4Worker } from './jobs/step4';
import { createStep6Worker } from './jobs/step6';

createStep1Worker();
createStep2Worker();
createStep3Worker();
createStep4Worker();
createStep6Worker();
