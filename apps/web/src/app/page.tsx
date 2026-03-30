import Link from 'next/link';

import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>C 端鞋履生成系统</p>
          <h1 className={styles.title}>从草图到概念图，一条清晰的三步链路。</h1>
          <p className={styles.subtitle}>
            免登录、轻量、可追踪。先用 mock 走通，再无缝切换真实 API。
          </p>
          <Link className={styles.cta} href="/wizard">
            进入生成向导
          </Link>
        </div>
        <div className={styles.preview}>
          <div className={styles.previewCard}>
            <p className={styles.previewTitle}>Step 1 · 草图</p>
            <div className={styles.previewImage} />
          </div>
          <div className={styles.previewCard}>
            <p className={styles.previewTitle}>Step 2 · 中文提示词</p>
            <div className={styles.previewText}>
              简洁利落的鞋履设计，比例匀称，材质细节清晰。
            </div>
          </div>
          <div className={styles.previewCard}>
            <p className={styles.previewTitle}>Step 3 · 概念图</p>
            <div className={styles.previewImageAlt} />
          </div>
        </div>
      </section>
    </main>
  );
}