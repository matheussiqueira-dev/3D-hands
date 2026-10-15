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
  // The textual pose follows the scene state.
  await expect(page.locator('#object-type')).toHaveText('Esfera');
  await expect(page.locator('#object-scale')).toHaveText('1,05×');
  await expect(page.locator('#object-position')).toHaveText('x 0,15 · y 0,00');
  await page.keyboard.press('r');
  await expect(page.locator('#object-scale')).toHaveText('1,0×');
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

test('the gesture panel lists exactly the recognizer gestures', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#gesture-panel .gesture-row');
  await expect(rows).toHaveCount(7);
  await expect(page.locator('#gesture-panel')).toContainText('Punho fechado');
  await expect(page.locator('#gesture-panel')).toContainText('segure 2 s · redefine o objeto');
  await expect(page.locator('#gesture-panel')).toContainText('segure 0,8 s · troca a cor');
  await expect(page.locator('body')).not.toContainText('Polegar');
  await expect(page.locator('body')).not.toContainText('%');
});

test('the shortcuts link opens the keyboard help and the reset button works', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__app?._scene);
  await page.getByRole('link', { name: 'Usar só o teclado' }).click();
  await expect(page.locator('#atalhos')).toHaveAttribute('open', '');
  await page.keyboard.press('c');
  await expect(page.locator('#object-color')).toHaveText('Pêssego');
  await page.keyboard.press('+');
  await page.getByRole('button', { name: 'Redefinir objeto' }).click();
  await expect(page.locator('#object-scale')).toHaveText('1,0×');
  await expect(page.locator('#announcer')).toHaveText('Objeto redefinido.');
});

test('the local server answers 404 to a malformed path instead of crashing', async ({ request }) => {
  expect((await request.get('/%E0%A4%A')).status()).toBe(404);
  expect((await request.get('/')).status()).toBe(200);
});

test('the hand model is not downloaded until the camera is started', async ({ page }) => {
  const mediapipe = [];
  page.on('request', (req) => { if (req.url().includes('@mediapipe')) mediapipe.push(req.url()); });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__app);
  expect(mediapipe).toEqual([]);
});
