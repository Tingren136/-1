'use client';

import Script from 'next/script';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';

import {
  buildStep1Prompt,
  getMaterials,
  getShoeShapes,
  getTextures,
  type Step1Input,
} from '@config/step1';

import styles from './wizard.module.css';

type StepId = 1 | 2 | 3 | 4 | 6;
type StepStatus = 'idle' | 'queued' | 'pending' | 'done' | 'error';
type Feedback = 'like' | 'dislike' | null;
type Step6DownloadFormat = 'glb' | 'obj';

type Step1Result = { imageUrl: string; prompt: string };
type Step2Result = { analysisCn: string; promptCn: string };
type Step3Result = { imageUrl: string; promptCn: string };

type Step4Result = {
  imageUrl: string;
  promptCn: string;
  blendPromptCn?: string;
  conceptImageUrl: string;
  userPhotoUrl: string;
  inputImageOrder?: string[];
  model?: string;
  targetAspectRatio?: number;
  requestedSize?: string;
};

type Step6Result = {
  glbUrl: string;
  objUrl: string;
  thumbnail: string;
  frontImageUrl: string;
  backImageUrl: string;
};

const shapes = getShoeShapes();
const materials = getMaterials();
const textures = getTextures();
const accessoryOptions = ['项链', '手环', '耳环'];
const colorModeOptions = [
  { value: 'single', label: '单色', hint: '只选择一种颜色' },
  { value: 'pair', label: '主辅色', hint: '选择主色 + 辅色' },
] as const;

type ColorMode = (typeof colorModeOptions)[number]['value'];

const colorOptions = [
  { value: 'cinnabar red', label: '朱红' },
  { value: 'cobalt blue', label: '钴蓝' },
  { value: 'jade green', label: '玉绿' },
  { value: 'ivory', label: '象牙白' },
  { value: 'charcoal', label: '炭黑' },
  { value: 'sand beige', label: '沙米' },
  { value: 'olive', label: '橄榄' },
  { value: 'rose gold', label: '玫瑰金' },
  { value: 'brushed silver', label: '拉丝银' },
];

const singleFields = [{ key: 'single', label: '单色', hint: '仅使用一种颜色' }];
const pairFields = [
  { key: 'primary', label: '主色', hint: '主体色块' },
  { key: 'secondary', label: '辅色', hint: '点缀或局部' },
];

export default function WizardPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [flowHint, setFlowHint] = useState('');
  const [activeStep, setActiveStep] = useState<StepId>(1);

  const [input, setInput] = useState<Step1Input>({
    shoeShapeId: shapes[0]?.id ?? '',
    materialId: materials[0]?.id ?? '',
    textureIds: textures.slice(0, 1).map((item) => item.id),
    colorSelection: {},
  });
  const [colorMode, setColorMode] = useState<ColorMode>('single');

  const [step1Prepared, setStep1Prepared] = useState(false);
  const [step1Feedback, setStep1Feedback] = useState<Feedback>(null);
  const [step1Status, setStep1Status] = useState<StepStatus>('idle');
  const [step1Result, setStep1Result] = useState<Step1Result | null>(null);

  const [accessoryTag, setAccessoryTag] = useState(accessoryOptions[0]);
  const [step2Prepared, setStep2Prepared] = useState(false);
  const [step2Feedback, setStep2Feedback] = useState<Feedback>(null);
  const [step2Status, setStep2Status] = useState<StepStatus>('idle');
  const [step2Result, setStep2Result] = useState<Step2Result | null>(null);

  const [step3Feedback, setStep3Feedback] = useState<Feedback>(null);
  const [step3Status, setStep3Status] = useState<StepStatus>('idle');
  const [step3Result, setStep3Result] = useState<Step3Result | null>(null);

  const [userPhotoUrl, setUserPhotoUrl] = useState('');
  const [photoHint, setPhotoHint] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [step4Feedback, setStep4Feedback] = useState<Feedback>(null);
  const [step4Status, setStep4Status] = useState<StepStatus>('idle');
  const [step4Result, setStep4Result] = useState<Step4Result | null>(null);

  const [step6Feedback, setStep6Feedback] = useState<Feedback>(null);
  const [step6Status, setStep6Status] = useState<StepStatus>('idle');
  const [step6Result, setStep6Result] = useState<Step6Result | null>(null);
  const [step6DownloadFormat, setStep6DownloadFormat] =
    useState<Step6DownloadFormat>('glb');

  const promptPreview = useMemo(() => buildStep1Prompt(input), [input]);
  const activeColorFields = colorMode === 'single' ? singleFields : pairFields;
  const step4PreviewStyle = step4Result?.targetAspectRatio
    ? { aspectRatio: String(step4Result.targetAspectRatio), height: 'auto' }
    : undefined;
  const step6DownloadUrl = useMemo(() => {
    if (!step6Result) return '';
    if (step6DownloadFormat === 'obj' && step6Result.objUrl) {
      return step6Result.objUrl;
    }
    if (step6DownloadFormat === 'glb' && step6Result.glbUrl) {
      return step6Result.glbUrl;
    }
    return step6Result.glbUrl || step6Result.objUrl || '';
  }, [step6DownloadFormat, step6Result]);

  useEffect(() => {
    let isMounted = true;
    async function initSession() {
      try {
        const res = await fetch('/api/session', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'session_failed');
        if (isMounted) setSessionId(data.sessionId as string);
      } catch {
        if (isMounted) {
          setSessionError('会话初始化失败，请刷新重试');
        }
      }
    }
    initSession();
    return () => {
      isMounted = false;
    };
  }, []);

  function isBusy(status: StepStatus) {
    return status === 'queued' || status === 'pending';
  }

  function formatStatus(status: StepStatus) {
    if (status === 'idle') return '待开始';
    if (status === 'queued' || status === 'pending') return '生成中...';
    if (status === 'done') return '已完成';
    return '失败';
  }

  function canEnterStep(step: StepId) {
    if (step === 1) return true;
    if (step === 2) return Boolean(step1Result);
    if (step === 3) return Boolean(step2Result);
    if (step === 4) return Boolean(step3Result);
    return Boolean(step3Result || step4Result);
  }

  function goToStep(step: StepId) {
    if (!canEnterStep(step)) {
      const prev = step === 2 ? 'Step 1' : step === 3 ? 'Step 2' : step === 4 ? 'Step 3' : 'Step 3/4';
      setFlowHint(`请先完成 ${prev}，再进入 Step ${step}`);
      return;
    }
    setFlowHint('');
    setActiveStep(step);
  }

  function resetFromStep(step: StepId) {
    if (step <= 1) {
      setStep1Feedback(null);
      setStep2Status('idle');
      setStep2Result(null);
      setStep2Feedback(null);
      setStep2Prepared(false);
      setStep3Status('idle');
      setStep3Result(null);
      setStep3Feedback(null);
      setStep4Status('idle');
      setStep4Result(null);
      setStep4Feedback(null);
      setStep6Status('idle');
      setStep6Result(null);
      setStep6Feedback(null);
      return;
    }

    if (step <= 2) {
      setStep2Feedback(null);
      setStep3Status('idle');
      setStep3Result(null);
      setStep3Feedback(null);
      setStep4Status('idle');
      setStep4Result(null);
      setStep4Feedback(null);
      setStep6Status('idle');
      setStep6Result(null);
      setStep6Feedback(null);
      return;
    }

    if (step <= 3) {
      setStep3Feedback(null);
      setStep4Status('idle');
      setStep4Result(null);
      setStep4Feedback(null);
      setStep6Status('idle');
      setStep6Result(null);
      setStep6Feedback(null);
      return;
    }

    if (step <= 4) {
      setStep4Feedback(null);
      setStep6Status('idle');
      setStep6Result(null);
      setStep6Feedback(null);
      return;
    }

    setStep6Feedback(null);
  }

  async function pollStep(
    step: StepId,
    onDone: (result: unknown) => void,
    setStatus: (status: StepStatus) => void,
  ) {
    if (!sessionId) return;
    setStatus('pending');
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/steps/${step}/status?sessionId=${sessionId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'status_failed');
        }
        if (data?.status === 'done') {
          clearInterval(timer);
          setStatus('done');
          onDone(data.result);
          return;
        }
        if (data?.status === 'failed') {
          clearInterval(timer);
          setStatus('error');
          const detail =
            (data?.error?.message as string | undefined) ||
            (data?.error?.errorMessage as string | undefined) ||
            '任务失败，请稍后重试';
          setFlowHint(`Step ${step} 失败：${detail}`);
          return;
        }
        if (data?.status === 'running') {
          setStatus('pending');
        }
      } catch {
        clearInterval(timer);
        setStatus('error');
      }
    }, 1600);
  }

  function submitStep1Config() {
    resetFromStep(1);
    setStep1Status('idle');
    setStep1Result(null);
    setStep1Prepared(true);
    setFlowHint('Step 1 参数已提交，点击“生成草图”开始。');
  }

  async function handleStep1() {
    if (!sessionId) return;
    if (!step1Prepared) {
      setFlowHint('请先点击“提交配置”，再生成草图。');
      return;
    }
    setFlowHint('');
    resetFromStep(1);
    setStep1Feedback(null);
    setStep1Status('queued');
    setStep1Result(null);
    const res = await fetch('/api/steps/1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input }),
    });
    if (!res.ok) {
      setStep1Status('error');
      return;
    }
    await pollStep(1, (result) => setStep1Result(result as Step1Result), setStep1Status);
  }

  function submitStep2Choice() {
    if (!step1Result) {
      setFlowHint('请先完成 Step 1。');
      return;
    }
    resetFromStep(2);
    setStep2Status('idle');
    setStep2Result(null);
    setStep2Prepared(true);
    setFlowHint('Step 2 饰品类型已提交，点击“生成提示词”开始。');
  }

  async function handleStep2() {
    if (!sessionId) return;
    if (!step1Result) {
      setFlowHint('请先完成 Step 1。');
      return;
    }
    if (!step2Prepared) {
      setFlowHint('请先点击“提交饰品选择”，再生成提示词。');
      return;
    }

    setFlowHint('');
    resetFromStep(2);
    setStep2Feedback(null);
    setStep2Status('queued');
    setStep2Result(null);
    const res = await fetch('/api/steps/2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, accessoryTag }),
    });
    if (!res.ok) {
      setStep2Status('error');
      return;
    }
    await pollStep(2, (result) => setStep2Result(result as Step2Result), setStep2Status);
  }

  async function handleStep3() {
    if (!sessionId) return;
    if (!step2Result) {
      setFlowHint('请先完成 Step 2。');
      return;
    }
    setFlowHint('');
    resetFromStep(3);
    setStep3Feedback(null);
    setStep3Status('queued');
    setStep3Result(null);
    const res = await fetch('/api/steps/3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) {
      setStep3Status('error');
      return;
    }
    await pollStep(3, (result) => setStep3Result(result as Step3Result), setStep3Status);
  }

  async function handleStep4() {
    if (!sessionId) return;
    if (!step3Result) {
      setFlowHint('请先完成 Step 3。');
      return;
    }
    if (!userPhotoUrl) {
      setPhotoHint('请先上传本地人像图片，或填写真实可访问的人像 URL。');
      return;
    }

    setFlowHint('');
    setPhotoHint('');
    setStep4Feedback(null);
    setStep4Status('queued');
    setStep4Result(null);

    const res = await fetch('/api/steps/4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userPhotoUrl }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setStep4Status('error');
      const detail =
        (data?.message as string | undefined) ||
        (data?.error as string | undefined) ||
        '提交失败，请检查图片地址';
      setFlowHint(`Step 4 失败：${detail}`);
      setPhotoHint(detail);
      return;
    }

    await pollStep(4, (result) => setStep4Result(result as Step4Result), setStep4Status);
  }

  async function handleStep6() {
    if (!sessionId) return;
    if (!step3Result && !step4Result) {
      setFlowHint('请先完成 Step 3 或 Step 4。');
      return;
    }

    setFlowHint('');
    setStep6Feedback(null);
    setStep6Status('queued');
    setStep6Result(null);

    const res = await fetch('/api/steps/6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!res.ok) {
      setStep6Status('error');
      return;
    }

    await pollStep(6, (result) => setStep6Result(result as Step6Result), setStep6Status);
  }

  async function uploadLocalPhoto(file: File) {
    try {
      setUploadingPhoto(true);
      setPhotoHint('正在上传本地图片，请稍候...');

      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data?.assetUrl) {
        setPhotoHint('本地图片上传失败，请重试或换一张图。');
        return;
      }

      setUserPhotoUrl(data.assetUrl as string);
      setStep4Status('idle');
      setStep4Result(null);
      resetFromStep(4);
      setPhotoHint('上传成功，已自动填入可用图片 URL。');
    } catch {
      setPhotoHint('本地图片上传失败，请重试或换一张图。');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleLocalPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await uploadLocalPhoto(file);
  }

  async function retryStep1FromFeedback() {
    if (!step1Result || isBusy(step1Status)) return;
    setStep1Feedback('dislike');
    setFlowHint('已标记 Step 1 不满意，正在重新生成草图...');
    await handleStep1();
  }

  async function retryStep2FromFeedback() {
    if (!step2Result || isBusy(step2Status)) return;
    setStep2Feedback('dislike');
    setFlowHint('已标记 Step 2 不满意，正在重新生成提示词...');
    await handleStep2();
  }

  async function retryStep3FromFeedback() {
    if (!step3Result || isBusy(step3Status)) return;
    setStep3Feedback('dislike');
    setFlowHint('已标记 Step 3 不满意，正在重新生成概念图...');
    await handleStep3();
  }

  function markStep1Dirty() {
    setStep1Prepared(false);
    if (step1Result || step1Status !== 'idle') {
      setStep1Status('idle');
      setStep1Result(null);
      resetFromStep(1);
      setFlowHint('Step 1 参数已变更，请重新提交配置并生成草图。');
    }
  }

  function markStep2Dirty() {
    setStep2Prepared(false);
    if (step2Result || step2Status !== 'idle') {
      setStep2Status('idle');
      setStep2Result(null);
      resetFromStep(2);
      setFlowHint('Step 2 选择已变更，请重新提交饰品并生成提示词。');
    }
  }

  function selectAccessory(option: string) {
    if (option === accessoryTag) return;
    markStep2Dirty();
    setAccessoryTag(option);
  }

  function toggleTexture(id: string) {
    markStep1Dirty();
    setInput((prev) => {
      const has = prev.textureIds.includes(id);
      const textureIds = has
        ? prev.textureIds.filter((item) => item !== id)
        : [...prev.textureIds, id];
      return { ...prev, textureIds };
    });
  }

  function updateColorField(key: string, value: string) {
    markStep1Dirty();
    setInput((prev) => {
      const next = { ...(prev.colorSelection || {}) } as Record<string, string>;
      if (!value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return { ...prev, colorSelection: next };
    });
  }

  function applyColorMode(mode: ColorMode) {
    markStep1Dirty();
    setColorMode(mode);
    setInput((prev) => ({
      ...prev,
      colorSelection: {},
      customColorPhrase: '',
    }));
  }

  function sectionClass(step: StepId) {
    const classNames = [styles.section];
    if (activeStep === step) classNames.push(styles.sectionActive);
    if (!canEnterStep(step)) classNames.push(styles.sectionLocked);
    return classNames.join(' ');
  }

  return (
    <main className={styles.page}>
      <Script
        type="module"
        src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
      />

      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>六步生成 · 流程向导</p>
          <h1 className={styles.title}>鞋履概念生成向导</h1>
        </div>
        <div className={styles.sessionBox}>
          <p className={styles.sessionLabel}>Session</p>
          <p className={styles.sessionValue}>{sessionId || '初始化中...'}</p>
          {sessionError ? <p className={styles.sessionError}>{sessionError}</p> : null}
        </div>
      </header>

      <nav className={styles.stepTabs}>
        {[1, 2, 3, 4, 6].map((id) => {
          const step = id as StepId;
          const disabled = !canEnterStep(step);
          return (
            <button
              key={id}
              type="button"
              className={activeStep === step ? styles.stepTabActive : styles.stepTab}
              disabled={disabled}
              onClick={() => goToStep(step)}
            >
              {`Step ${step}`}
            </button>
          );
        })}
      </nav>

      {flowHint ? <p className={styles.flowHint}>{flowHint}</p> : null}

      <section className={sectionClass(1)}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 1 · 草图生成</h2>
            <p>先提交参数，再生成草图。</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.secondaryBtn} onClick={submitStep1Config}>
              提交配置
            </button>
            <button
              className={styles.primaryBtn}
              onClick={handleStep1}
              disabled={!step1Prepared || isBusy(step1Status)}
            >
              生成草图
            </button>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <label className={styles.label}>鞋型</label>
            <select
              value={input.shoeShapeId}
              onChange={(event) => {
                markStep1Dirty();
                setInput((prev) => ({
                  ...prev,
                  shoeShapeId: event.target.value,
                }));
              }}
            >
              {shapes.map((shape) => (
                <option key={shape.id} value={shape.id}>
                  {shape.label}
                </option>
              ))}
            </select>

            <label className={styles.label}>材质</label>
            <select
              value={input.materialId}
              onChange={(event) => {
                markStep1Dirty();
                setInput((prev) => ({
                  ...prev,
                  materialId: event.target.value,
                }));
              }}
            >
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.label}
                </option>
              ))}
            </select>

            <label className={styles.label}>纹理</label>
            <div className={styles.chips}>
              {textures.map((texture) => {
                const active = input.textureIds.includes(texture.id);
                return (
                  <button
                    type="button"
                    key={texture.id}
                    className={active ? styles.chipActive : styles.chip}
                    onClick={() => toggleTexture(texture.id)}
                  >
                    {texture.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.card}>
            <label className={styles.label}>颜色模板参数</label>
            <div className={styles.modeToggle}>
              {colorModeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    colorMode === option.value
                      ? styles.modeButtonActive
                      : styles.modeButton
                  }
                  onClick={() => applyColorMode(option.value)}
                >
                  {option.label}
                  <span className={styles.modeHint}>{option.hint}</span>
                </button>
              ))}
            </div>
            <div className={styles.colorGrid}>
              {activeColorFields.map((field) => {
                const current =
                  (input.colorSelection as Record<string, string>)?.[field.key] || '';
                return (
                  <div key={field.key} className={styles.colorField}>
                    <div className={styles.colorMeta}>
                      <span className={styles.colorLabel}>{field.label}</span>
                      <span className={styles.colorHint}>{field.hint}</span>
                    </div>
                    <div className={styles.chips}>
                      <button
                        type="button"
                        className={!current ? styles.chipActive : styles.chip}
                        onClick={() => updateColorField(field.key, '')}
                      >
                        不使用
                      </button>
                      {colorOptions.map((option) => {
                        const active = current === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={active ? styles.chipActive : styles.chip}
                            onClick={() => updateColorField(field.key, option.value)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <label className={styles.label}>自定义颜色短语</label>
            <input
              placeholder="例如：沉稳的暖棕色，搭配细微金属光泽"
              value={input.customColorPhrase || ''}
              onChange={(event) => {
                markStep1Dirty();
                setInput((prev) => ({
                  ...prev,
                  customColorPhrase: event.target.value,
                }));
              }}
            />

            <label className={styles.label}>Prompt 预览</label>
            <div className={styles.promptPreview}>{promptPreview}</div>
          </div>

          <div className={styles.card}>
            <label className={styles.label}>生成状态</label>
            <p className={styles.status}>{formatStatus(step1Status)}</p>
            <div className={styles.imageBox}>
              {step1Result?.imageUrl ? (
                <img src={step1Result.imageUrl} alt="step1" />
              ) : (
                <span>等待生成</span>
              )}
            </div>
            <div className={styles.feedbackRow}>
              <button
                type="button"
                className={step1Feedback === 'like' ? styles.feedbackButtonActive : styles.feedbackButton}
                onClick={() => setStep1Feedback('like')}
                disabled={!step1Result}
              >
                满意
              </button>
              <button
                type="button"
                className={step1Feedback === 'dislike' ? styles.feedbackButtonActive : styles.feedbackButton}
                onClick={() => void retryStep1FromFeedback()}
                disabled={!step1Result || isBusy(step1Status)}
              >
                不满意
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => goToStep(2)}
                disabled={!step1Result}
              >
                下一步
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass(2)}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 2 · 中文提示词</h2>
            <p>先提交饰品类型，再生成提示词。</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.secondaryBtn} onClick={submitStep2Choice} disabled={!step1Result}>
              提交饰品选择
            </button>
            <button
              className={styles.primaryBtn}
              onClick={handleStep2}
              disabled={!step2Prepared || isBusy(step2Status)}
            >
              生成提示词
            </button>
          </div>
        </div>

        <div className={styles.gridTwo}>
          <div className={styles.card}>
            <label className={styles.label}>饰品类型</label>
            <p className={styles.helperText}>选择你希望附加的饰品类型</p>
            <div className={styles.chips}>
              {accessoryOptions.map((option) => {
                const active = accessoryTag === option;
                return (
                  <button
                    key={option}
                    type="button"
                    className={active ? styles.chipActive : styles.chip}
                    onClick={() => selectAccessory(option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <label className={styles.label}>状态</label>
            <p className={styles.status}>{formatStatus(step2Status)}</p>
          </div>
          <div className={styles.card}>
            <label className={styles.label}>中文描述</label>
            <div className={styles.textBlock}>{step2Result?.analysisCn || '等待生成'}</div>
            <label className={styles.label}>Prompt</label>
            <div className={styles.textBlock}>{step2Result?.promptCn || '等待生成'}</div>
            <div className={styles.feedbackRow}>
              <button
                type="button"
                className={step2Feedback === 'like' ? styles.feedbackButtonActive : styles.feedbackButton}
                onClick={() => setStep2Feedback('like')}
                disabled={!step2Result}
              >
                满意
              </button>
              <button
                type="button"
                className={step2Feedback === 'dislike' ? styles.feedbackButtonActive : styles.feedbackButton}
                onClick={() => void retryStep2FromFeedback()}
                disabled={!step2Result || isBusy(step2Status)}
              >
                不满意
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => goToStep(3)}
                disabled={!step2Result}
              >
                下一步
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass(3)}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 3 · 概念图</h2>
            <p>基于 Step 2 的提示词生成概念图。</p>
          </div>
          <button className={styles.primaryBtn} onClick={handleStep3} disabled={isBusy(step3Status)}>
            生成概念图
          </button>
        </div>

        <div className={styles.gridTwo}>
          <div className={styles.card}>
            <label className={styles.label}>状态</label>
            <p className={styles.status}>{formatStatus(step3Status)}</p>
            <div className={`${styles.imageBox} ${styles.landscapeImageBox}`}>
              {step3Result?.imageUrl ? (
                <img src={step3Result.imageUrl} alt="step3" />
              ) : (
                <span>等待生成</span>
              )}
            </div>
          </div>
          <div className={styles.card}>
            <label className={styles.label}>提示</label>
            <div className={styles.textBlock}>{step3Result?.promptCn || '将沿用 Step 2 的 prompt'}</div>
            <div className={styles.feedbackRow}>
              <button
                type="button"
                className={step3Feedback === 'like' ? styles.feedbackButtonActive : styles.feedbackButton}
                onClick={() => setStep3Feedback('like')}
                disabled={!step3Result}
              >
                满意
              </button>
              <button
                type="button"
                className={step3Feedback === 'dislike' ? styles.feedbackButtonActive : styles.feedbackButton}
                onClick={() => void retryStep3FromFeedback()}
                disabled={!step3Result || isBusy(step3Status)}
              >
                不满意
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => goToStep(4)}
                disabled={!step3Result}
              >
                下一步
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass(4)}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 4 · 用户图融合</h2>
            <p>上传本地图片或填写用户照片 URL，融合概念图。</p>
          </div>
          <button className={styles.primaryBtn} onClick={handleStep4} disabled={isBusy(step4Status)}>
            生成融合图
          </button>
        </div>

        <div className={styles.gridTwo}>
          <div className={styles.card}>
            <label className={styles.label}>本地图片上传</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLocalPhotoChange}
              disabled={uploadingPhoto}
            />

            <label className={styles.label}>用户照片地址</label>
            <input
              placeholder="粘贴真实可访问的人像 URL（也可直接用上方本地上传）"
              value={userPhotoUrl}
              onChange={(event) => {
                setUserPhotoUrl(event.target.value);
                setStep4Status('idle');
                setStep4Result(null);
                resetFromStep(4);
              }}
            />
            {photoHint ? <p className={styles.helperText}>{photoHint}</p> : null}
            <label className={styles.label}>状态</label>
            <p className={styles.status}>{formatStatus(step4Status)}</p>
          </div>

          <div className={styles.card}>
            <label className={styles.label}>融合图</label>
            <div className={`${styles.imageBox} ${styles.containImageBox}`} style={step4PreviewStyle}>
              {step4Result?.imageUrl ? (
                <img src={step4Result.imageUrl} alt="step4" />
              ) : (
                <span>等待生成</span>
              )}
            </div>
            <label className={styles.label}>来源</label>
            <div className={styles.textBlock}>
              {step4Result
                ? `概念图: ${step4Result.conceptImageUrl}\n用户图: ${step4Result.userPhotoUrl}`
                : '将使用 Step3 概念图 + 你填写的用户照片 URL'}
            </div>
            {step4Result ? (
              <>
                <label className={styles.label}>图一/图二（实际传入）</label>
                <div className={styles.gridTwo}>
                  <div className={styles.card}>
                    <p className={styles.helperText}>图一（用户图）</p>
                    <div className={`${styles.imageBox} ${styles.containImageBox}`}>
                      <img src={step4Result.inputImageOrder?.[0] || step4Result.userPhotoUrl} alt="step4-input-1" />
                    </div>
                  </div>
                  <div className={styles.card}>
                    <p className={styles.helperText}>图二（首饰概念图）</p>
                    <div className={`${styles.imageBox} ${styles.containImageBox}`}>
                      <img
                        src={step4Result.inputImageOrder?.[1] || step4Result.conceptImageUrl}
                        alt="step4-input-2"
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.textBlock}>
                  {`模型: ${step4Result.model || 'unknown'}\n请求尺寸: ${step4Result.requestedSize || 'unknown'}`}
                </div>
              </>
            ) : null}
            <label className={styles.label}>融合提示词</label>
            <div className={styles.textBlock}>
              {step4Result?.blendPromptCn || '给图一的女生，带上图二的首饰，然后首饰要细小一点。'}
            </div>
            <div className={styles.feedbackRow}>
              <button
                type="button"
                className={step4Feedback === 'like' ? styles.feedbackButtonActive : styles.feedbackButton}
                onClick={() => setStep4Feedback('like')}
                disabled={!step4Result}
              >
                满意
              </button>
              <button
                type="button"
                className={step4Feedback === 'dislike' ? styles.feedbackButtonActive : styles.feedbackButton}
                onClick={() => setStep4Feedback('dislike')}
                disabled={!step4Result}
              >
                不满意
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => goToStep(6)}
                disabled={!step3Result && !step4Result}
              >
                下一步
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass(6)}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 6 · 多视图 3D</h2>
            <p>默认基于 Step3（优先）生成 3D，并自动将前视图水平翻转补成后视图。</p>
          </div>
          <button className={styles.primaryBtn} onClick={handleStep6} disabled={isBusy(step6Status)}>
            生成 3D 资源
          </button>
        </div>

        <div className={styles.step6Studio}>
          <div className={styles.step6Viewport}>
            <div className={styles.step6ViewportHead}>
              <span>3D 预览</span>
              <span>{formatStatus(step6Status)}</span>
            </div>
            <div className={styles.step6Canvas}>
              {step6Result?.glbUrl ? (
                <model-viewer
                  src={step6Result.glbUrl}
                  poster={step6Result.thumbnail}
                  camera-controls
                  auto-rotate
                  ar
                  shadow-intensity="1"
                  style={{ width: '100%', height: '100%' }}
                />
              ) : step6Result?.thumbnail ? (
                <img src={step6Result.thumbnail} alt="step6-thumb" />
              ) : (
                <span className={styles.step6Empty}>等待生成</span>
              )}
            </div>
            <p className={styles.step6CanvasHint}>拖拽旋转模型，滚轮缩放查看细节。</p>
          </div>

          <aside className={styles.step6Panel}>
            <div className={styles.step6PanelCard}>
              <label className={styles.label}>下载</label>
              <div className={styles.step6DownloadRow}>
                <select
                  className={styles.step6FormatSelect}
                  value={step6DownloadFormat}
                  onChange={(event) =>
                    setStep6DownloadFormat(event.target.value as Step6DownloadFormat)
                  }
                >
                  <option value="glb">GLB</option>
                  <option value="obj">OBJ</option>
                </select>
                <a
                  href={step6DownloadUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={
                    step6DownloadUrl
                      ? styles.step6DownloadBtn
                      : `${styles.step6DownloadBtn} ${styles.step6DownloadBtnDisabled}`
                  }
                  aria-disabled={!step6DownloadUrl}
                >
                  下载
                </a>
              </div>
            </div>

            <div className={styles.step6PanelCard}>
              <label className={styles.label}>参考视图</label>
              <div className={styles.step6Refs}>
                <a
                  className={styles.step6RefLink}
                  href={step6Result?.frontImageUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  {step6Result?.frontImageUrl ? (
                    <img src={step6Result.frontImageUrl} alt="front-view" />
                  ) : (
                    <span>前视图</span>
                  )}
                </a>
                <a
                  className={styles.step6RefLink}
                  href={step6Result?.backImageUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  {step6Result?.backImageUrl ? (
                    <img src={step6Result.backImageUrl} alt="back-view" />
                  ) : (
                    <span>后视图</span>
                  )}
                </a>
              </div>
            </div>

            <div className={styles.step6PanelCard}>
              <label className={styles.label}>输出链接</label>
              <div className={styles.linkList}>
                <a href={step6Result?.glbUrl || '#'} target="_blank" rel="noreferrer">
                  GLB 文件
                </a>
                <a href={step6Result?.objUrl || '#'} target="_blank" rel="noreferrer">
                  OBJ 文件
                </a>
              </div>
              <div className={styles.feedbackRow}>
                <button
                  type="button"
                  className={step6Feedback === 'like' ? styles.feedbackButtonActive : styles.feedbackButton}
                  onClick={() => setStep6Feedback('like')}
                  disabled={!step6Result}
                >
                  满意
                </button>
                <button
                  type="button"
                  className={step6Feedback === 'dislike' ? styles.feedbackButtonActive : styles.feedbackButton}
                  onClick={() => setStep6Feedback('dislike')}
                  disabled={!step6Result}
                >
                  不满意
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
