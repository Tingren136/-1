import type { Step1Input } from '../config/step1';

export interface StepPayloadBase {
  sessionId: string;
}

export interface Step1Payload extends StepPayloadBase {
  prompt: string;
  selections?: Step1Input;
}

export interface Step2Payload extends StepPayloadBase {
  step1ImageUrl: string;
  accessoryTag: string;
}

export interface Step3Payload extends StepPayloadBase {
  promptCn: string;
}

export interface Step4Payload extends StepPayloadBase {
  promptCn: string;
  conceptImageUrl: string;
  userPhotoUrl: string;
}

export interface Step6Payload extends StepPayloadBase {
  promptCn: string;
  frontImageUrl: string;
  backImageUrl?: string;
}

export type StepName = 'step1' | 'step2' | 'step3' | 'step4' | 'step6';

export type StepStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface StepResult<T = unknown> {
  status: StepStatus;
  data?: T;
  error?: string;
}

export type SessionState = Partial<Record<StepName, StepResult>>;
