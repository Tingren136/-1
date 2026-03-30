import { expect, test } from '@playwright/test';

test('wizard page renders major step headers', async ({ page }) => {
  await page.goto('/wizard');

  await expect(page.getByRole('heading', { name: '鞋履概念生成向导' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Step 1 · 草图生成' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Step 4 · 用户图融合' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Step 6 · 多视图 3D' })).toBeVisible();
});
