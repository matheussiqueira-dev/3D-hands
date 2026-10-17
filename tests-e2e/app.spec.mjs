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

test('the hand model and the GLTFLoader are not downloaded until they are needed', async ({ page }) => {
  const requested = [];
  page.on('request', (req) => requested.push(new URL(req.url()).pathname));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__app?._scene);
  const vendor = requested.filter((path) => path.startsWith('/vendor/'));
  // Three.js itself is needed for the scene; MediaPipe (module, WASM, model) and the loader are not.
  expect(vendor.some((path) => /^\/vendor\/three-[A-Z0-9]{8}\.js$/.test(path))).toBe(true);
  expect(vendor.filter((path) => /hand-landmarker|hand_landmarker|tasks-vision|gltf-loader/.test(path))).toEqual([]);
});

test('the page loads with a clean console (no errors, CSP violations or deprecation warnings)', async ({ page }) => {
  const messages = [];
  page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) messages.push(`${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', (err) => messages.push(`pageerror: ${err.message}`));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__app?._scene);
  // Headless software WebGL logs GPU stall notices that are not page problems.
  expect(messages.filter((m) => !/GPU stall|GL Driver Message/i.test(m))).toEqual([]);
});

test('letter shortcuts work after clicking a button, but Space still activates the focused button', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__app?._scene);
  await page.getByRole('button', { name: 'Redefinir objeto' }).click();
  await page.keyboard.press('n');
  await expect(page.locator('#object-type')).toHaveText('Esfera');
  await page.keyboard.press('+');
  await expect(page.locator('#object-scale')).toHaveText('1,05×');
  await page.keyboard.press(' '); // activates the focused "Redefinir objeto" button
  await expect(page.locator('#object-scale')).toHaveText('1,0×');
});
