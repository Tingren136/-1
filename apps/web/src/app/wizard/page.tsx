'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  buildStep1Prompt,
  getMaterials,
  getShoeShapes,
  getTextures,
  type Step1Input,
} from '@config/step1';

import styles from './wizard.module.css';

type StepStatus = 'idle' | 'queued' | 'pending' | 'done' | 'error';

type Step1Result = { imageUrl: string; prompt: string };

type Step2Result = { analysisCn: string; promptCn: string };

type Step3Result = { imageUrl: string; promptCn: string };

type Step4Result = {
  imageUrl: string;
  promptCn: string;
  conceptImageUrl: string;
  userPhotoUrl: string;
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

  const [input, setInput] = useState<Step1Input>({
    shoeShapeId: shapes[0]?.id ?? '',
    materialId: materials[0]?.id ?? '',
    textureIds: textures.slice(0, 1).map((item) => item.id),
    colorSelection: {},
  });
  const [colorMode, setColorMode] = useState<ColorMode>('single');

  const [step1Status, setStep1Status] = useState<StepStatus>('idle');
  const [step1Result, setStep1Result] = useState<Step1Result | null>(null);

  const [accessoryTag, setAccessoryTag] = useState(accessoryOptions[0]);
  const [step2Status, setStep2Status] = useState<StepStatus>('idle');
  const [step2Result, setStep2Result] = useState<Step2Result | null>(null);

  const [step3Status, setStep3Status] = useState<StepStatus>('idle');
  const [step3Result, setStep3Result] = useState<Step3Result | null>(null);

  const [userPhotoUrl, setUserPhotoUrl] = useState('');
  const [photoHint, setPhotoHint] = useState('');
  const [step4Status, setStep4Status] = useState<StepStatus>('idle');
  const [step4Result, setStep4Result] = useState<Step4Result | null>(null);

  const [step6Status, setStep6Status] = useState<StepStatus>('idle');
  const [step6Result, setStep6Result] = useState<Step6Result | null>(null);

  const promptPreview = useMemo(() => buildStep1Prompt(input), [input]);
  const activeColorFields = colorMode === 'single' ? singleFields : pairFields;

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

  async function pollStep(
    step: 1 | 2 | 3 | 4 | 6,
    onDone: (result: unknown) => void,
    setStatus: (status: StepStatus) => void,
  ) {
    if (!sessionId) return;
    setStatus('pending');
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/steps/${step}/status?sessionId=${sessionId}`);
        const data = await res.json();
        if (data?.status === 'done') {
          clearInterval(timer);
          setStatus('done');
          onDone(data.result);
        }
      } catch {
        clearInterval(timer);
        setStatus('error');
      }
    }, 1600);
  }

  async function handleStep1() {
    if (!sessionId) return;
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

  async function handleStep2() {
    if (!sessionId) return;
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
    if (!sessionId || !userPhotoUrl) {
      setPhotoHint('请先填写用户照片 URL（可用下方 mock 地址按钮快速生成）');
      return;
    }

    setPhotoHint('');
    setStep4Status('queued');
    setStep4Result(null);

    const res = await fetch('/api/steps/4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userPhotoUrl }),
    });

    if (!res.ok) {
      setStep4Status('error');
      return;
    }

    await pollStep(4, (result) => setStep4Result(result as Step4Result), setStep4Status);
  }

  async function handleStep6() {
    if (!sessionId) return;
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

  async function generateMockUploadUrl() {
    try {
      const res = await fetch('/api/assets/upload', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.assetUrl) {
        setPhotoHint('生成 mock 上传地址失败，请稍后重试');
        return;
      }
      setUserPhotoUrl(data.assetUrl as string);
      setPhotoHint('已填入 mock 照片地址，可直接执行 Step 4');
    } catch {
      setPhotoHint('生成 mock 上传地址失败，请稍后重试');
    }
  }

  function toggleTexture(id: string) {
    setInput((prev) => {
      const has = prev.textureIds.includes(id);
      const textureIds = has
        ? prev.textureIds.filter((item) => item !== id)
        : [...prev.textureIds, id];
      return { ...prev, textureIds };
    });
  }

  function updateColorField(key: string, value: string) {
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
    setColorMode(mode);
    setInput((prev) => ({
      ...prev,
      colorSelection: {},
      customColorPhrase: '',
    }));
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>六步生成 · Mock 模式</p>
          <h1 className={styles.title}>鞋履概念生成向导</h1>
        </div>
        <div className={styles.sessionBox}>
          <p className={styles.sessionLabel}>Session</p>
          <p className={styles.sessionValue}>{sessionId || '初始化中...'}</p>
          {sessionError ? <p className={styles.sessionError}>{sessionError}</p> : null}
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 1 · 草图生成</h2>
            <p>选择鞋型、材质与纹理，生成草图。</p>
          </div>
          <button className={styles.primaryBtn} onClick={handleStep1}>
            生成草图
          </button>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <label className={styles.label}>鞋型</label>
            <select
              value={input.shoeShapeId}
              onChange={(event) =>
                setInput((prev) => ({
                  ...prev,
                  shoeShapeId: event.target.value,
                }))
              }
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
              onChange={(event) =>
                setInput((prev) => ({
                  ...prev,
                  materialId: event.target.value,
                }))
              }
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
              onChange={(event) =>
                setInput((prev) => ({
                  ...prev,
                  customColorPhrase: event.target.value,
                }))
              }
            />

            <label className={styles.label}>Prompt 预览</label>
            <div className={styles.promptPreview}>{promptPreview}</div>
          </div>

          <div className={styles.card}>
            <label className={styles.label}>生成状态</label>
            <p className={styles.status}>{step1Status}</p>
            <div className={styles.imageBox}>
              {step1Result?.imageUrl ? (
                <img src={step1Result.imageUrl} alt="step1" />
              ) : (
                <span>等待生成</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 2 · 中文提示词</h2>
            <p>输入饰品类型，生成中文描述与 prompt。</p>
          </div>
          <button className={styles.primaryBtn} onClick={handleStep2}>
            生成提示词
          </button>
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
                    onClick={() => setAccessoryTag(option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <label className={styles.label}>状态</label>
            <p className={styles.status}>{step2Status}</p>
          </div>
          <div className={styles.card}>
            <label className={styles.label}>中文描述</label>
            <div className={styles.textBlock}>{step2Result?.analysisCn || '等待生成'}</div>
            <label className={styles.label}>Prompt</label>
            <div className={styles.textBlock}>{step2Result?.promptCn || '等待生成'}</div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 3 · 概念图</h2>
            <p>基于 Step 2 的 prompt 生成概念图。</p>
          </div>
          <button className={styles.primaryBtn} onClick={handleStep3}>
            生成概念图
          </button>
        </div>

        <div className={styles.gridTwo}>
          <div className={styles.card}>
            <label className={styles.label}>状态</label>
            <p className={styles.status}>{step3Status}</p>
            <div className={styles.imageBox}>
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
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 4 · 用户图融合</h2>
            <p>上传（mock）或填写用户照片地址，融合概念图。</p>
          </div>
          <button className={styles.primaryBtn} onClick={handleStep4}>
            生成融合图
          </button>
        </div>

        <div className={styles.gridTwo}>
          <div className={styles.card}>
            <label className={styles.label}>用户照片地址</label>
            <input
              placeholder="粘贴用户照片 URL，或点击下方按钮生成 mock 地址"
              value={userPhotoUrl}
              onChange={(event) => setUserPhotoUrl(event.target.value)}
            />
            <div className={styles.inlineRow}>
              <button type="button" className={styles.secondaryBtn} onClick={generateMockUploadUrl}>
                生成 mock 上传地址
              </button>
            </div>
            {photoHint ? <p className={styles.helperText}>{photoHint}</p> : null}
            <label className={styles.label}>状态</label>
            <p className={styles.status}>{step4Status}</p>
          </div>

          <div className={styles.card}>
            <label className={styles.label}>融合图</label>
            <div className={styles.imageBox}>
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
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Step 6 · 多视图 3D</h2>
            <p>基于 Step4（优先）或 Step3 结果生成 3D 资源。</p>
          </div>
          <button className={styles.primaryBtn} onClick={handleStep6}>
            生成 3D 资源
          </button>
        </div>

        <div className={styles.gridTwo}>
          <div className={styles.card}>
            <label className={styles.label}>状态</label>
            <p className={styles.status}>{step6Status}</p>
            <div className={styles.imageBox}>
              {step6Result?.thumbnail ? (
                <img src={step6Result.thumbnail} alt="step6-thumb" />
              ) : (
                <span>等待生成</span>
              )}
            </div>
          </div>
          <div className={styles.card}>
            <label className={styles.label}>3D 输出</label>
            <div className={styles.linkList}>
              <a href={step6Result?.glbUrl || '#'} target="_blank" rel="noreferrer">
                GLB 文件
              </a>
              <a href={step6Result?.objUrl || '#'} target="_blank" rel="noreferrer">
                OBJ 文件
              </a>
              <a href={step6Result?.frontImageUrl || '#'} target="_blank" rel="noreferrer">
                前视图
              </a>
              <a href={step6Result?.backImageUrl || '#'} target="_blank" rel="noreferrer">
                后视图
              </a>
            </div>
            <p className={styles.helperText}>
              当前为 mock 结果。真实接入后可直接替换为真实 3D URL。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
