import { test, expect } from '@playwright/test';

test('keyboard controls the object without a camera', async ({ page }) => {
  const apiCalls = [];
  page.on('request', (req) => { if (req.url().includes('/api/')) apiCalls.push(req.url()); });
  await page.goto('/');
  await page.waitForFunction(() => window.__app?._scene);
  for (const key of ['n', 'ArrowRight', '+']) await page.keyboard.press(key);
  const state = await page.evaluate(() => ({
    shape: window.__app._scene.currentShape,
    scale: window.__app._scene.currentScale,
  }));
  expect(state.shape).toBe('sphere');
  expect(state.scale).toBeGreaterThan(1);
  expect(apiCalls).toEqual([]);
});
