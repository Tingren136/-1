import { NextResponse } from 'next/server';

import { getSessionField, setSessionField } from '@workflow/redis';
import { step4Queue } from '@workflow/queues';

type Step2State = { promptCn?: string; accessoryTag?: string };
type Step3State = { imageUrl?: string };

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = body?.sessionId as string | undefined;
  const userPhotoUrl = body?.userPhotoUrl as string | undefined;
  const providedPrompt = body?.promptCn as string | undefined;
  const providedConcept = body?.conceptImageUrl as string | undefined;

  if (!sessionId || !userPhotoUrl) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let parsedPhotoUrl: URL | undefined;
  try {
    parsedPhotoUrl = new URL(userPhotoUrl);
  } catch {
    return NextResponse.json({ error: 'invalid_user_photo_url' }, { status: 400 });
  }
  if (!['http:', 'https:'].includes(parsedPhotoUrl.protocol)) {
    return NextResponse.json({ error: 'invalid_user_photo_url' }, { status: 400 });
  }

  const isMockAssetUrl = /example\.com\/mock-assets/i.test(userPhotoUrl);
  const isRealStep4Mode = process.env.JIMENG_MOCK === '0';
  if (isRealStep4Mode && isMockAssetUrl) {
    return NextResponse.json(
      {
        error: 'mock_photo_url_not_allowed',
        message:
          'Step4 实时融合需要真实可访问的人像 URL。请使用“本地图片上传”或粘贴真实公网图片地址。',
      },
      { status: 400 },
    );
  }

  let promptCn = providedPrompt;
  let accessoryTag: string | undefined;
  if (!promptCn) {
    const step2 = await getSessionField<Step2State>(sessionId, 'step2');
    promptCn = step2?.promptCn;
    accessoryTag = step2?.accessoryTag;
  } else {
    const step2 = await getSessionField<Step2State>(sessionId, 'step2');
    accessoryTag = step2?.accessoryTag;
  }

  if (!promptCn) {
    return NextResponse.json({ error: 'missing_step2_prompt' }, { status: 400 });
  }

  let conceptImageUrl = providedConcept;
  if (!conceptImageUrl) {
    const step3 = await getSessionField<Step3State>(sessionId, 'step3');
    conceptImageUrl = step3?.imageUrl;
  }

  if (!conceptImageUrl) {
    return NextResponse.json({ error: 'missing_step3_image' }, { status: 400 });
  }

  await setSessionField(sessionId, 'step4', null);
  await setSessionField(sessionId, 'step4Error', null);
  await setSessionField(sessionId, 'step4Status', 'running');
  await setSessionField(sessionId, 'currentStep', 4);

  const job = await step4Queue.add('blend', {
    sessionId,
    promptCn,
    conceptImageUrl,
    userPhotoUrl,
    accessoryTag,
  });

  return NextResponse.json({ status: 'queued', jobId: job.id });
}
