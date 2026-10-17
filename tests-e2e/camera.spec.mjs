import { test, expect } from '@playwright/test';

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    ],
  },
});

test('hand tracking starts with a fake camera under the CSP, loading nothing from other origins', async ({ page, baseURL }) => {
  const problems = [];
  const foreign = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(String(baseURL)).origin) foreign.push(req.url());
  });
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(msg.text()); });
  page.on('pageerror', (err) => problems.push(err.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__app);
  await page.locator('#start-btn').click();
  // Asserting on the visible chip reports the actual state (iniciando / erro) on failure.
  await expect(page.locator('#camera-status')).toHaveText('Câmera: ativa', { timeout: 45_000 });
  await expect(page.getByRole('alert')).toBeHidden();
  // The model is processing frames: results arrive even without a hand in view.
  await expect.poll(() => page.evaluate(() => window.__app._fps.value), { timeout: 30_000 }).toBeGreaterThan(0);
  expect(foreign).toEqual([]);
  expect(problems.filter((p) => /Content Security Policy|Refused/i.test(p))).toEqual([]);
});
