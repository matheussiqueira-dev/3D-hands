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

test('responses carry the security headers from vercel.json', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['permissions-policy']).toContain('camera=(self)');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['cross-origin-embedder-policy']).toBeUndefined();
  expect((await request.get('/rota-inexistente')).status()).toBe(404);
});
