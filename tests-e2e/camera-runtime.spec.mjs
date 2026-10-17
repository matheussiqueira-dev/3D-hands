import { test, expect } from '@playwright/test';
import { POSES } from '../tests-web/hand-fixtures.mjs';

// A canvas stream stands in for the webcam and a scripted HandLandmarker module
// (served in place of the self-hosted /vendor/hand-landmarker-*.js bundle) for
// MediaPipe, so these run fast and exercise the app's own runtime paths.
const FAKE_VISION_MODULE = `
export const WASM_BASE_URL = '/vendor/fake-wasm';
export const MODEL_URL = '/vendor/fake.task';
export const FilesetResolver = { forVisionTasks: async (base) => ({ wasmLoaderPath: base + '/loader.js', wasmBinaryPath: base + '/bin.wasm' }) };
export class HandLandmarker {
  static HAND_CONNECTIONS = [{ start: 0, end: 1 }, { start: 1, end: 2 }];
  static async createFromOptions(fileset, options) {
    const fake = window.__fake;
    fake.created.push(options);
    if (fake.failGpu && options.baseOptions.delegate === 'GPU') throw new Error('simulated WebGL failure');
    return new HandLandmarker();
  }
  detectForVideo(video, timestamp) {
    const fake = window.__fake;
    fake.sends += 1;
    if (timestamp <= fake.lastTimestamp) fake.nonIncreasing += 1;
    fake.lastTimestamp = timestamp;
    if (fake.failSend) throw new Error('simulated inference failure');
    return {
      landmarks: fake.hands.map((hand) => hand.landmarks),
      worldLandmarks: [],
      handedness: fake.hands.map((hand) => [{ categoryName: hand.label, displayName: hand.label, score: 0.9, index: 0 }]),
      handednesses: [],
    };
  }
  close() { window.__fake.closed += 1; }
}`;

/** @param {import('@playwright/test').Page} page @param {{ failGpu?: boolean }} [options] */
async function fakeCameraAndModel(page, { failGpu = false } = {}) {
  await page.route('**/vendor/hand-landmarker-*.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_VISION_MODULE }));
  await page.addInitScript((gpuFails) => {
    window.__fake = { failSend: false, failGpu: gpuFails, sends: 0, closed: 0, created: [], hands: [], lastTimestamp: -1, nonIncreasing: 0, track: null };
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 48 });
      const ctx = canvas.getContext('2d');
      // Repaint so the stream keeps producing new frames (HandLandmarker only sees new ones).
      let shade = 0;
      setInterval(() => { shade = (shade + 1) % 255; ctx.fillStyle = `rgb(${shade},0,0)`; ctx.fillRect(0, 0, 64, 48); }, 50);
      const stream = canvas.captureStream(15);
      window.__fake.track = stream.getVideoTracks()[0];
      return stream;
    };
  }, failGpu);
}

test('HandLandmarker runs in VIDEO mode with the self-hosted model and its results reach the app', async ({ page }) => {
  await fakeCameraAndModel(page);
  await page.goto('/');
  await page.waitForFunction(() => window.__app);
  await page.locator('#start-btn').click();
  await expect(page.locator('#camera-status')).toHaveText('Câmera: ativa');

  const [options] = await page.evaluate(() => window.__fake.created);
  expect(options).toMatchObject({ runningMode: 'VIDEO', numHands: 2, baseOptions: { delegate: 'GPU', modelAssetPath: '/vendor/fake.task' } });

  await page.evaluate((landmarks) => { window.__fake.hands = [{ landmarks, label: 'Right' }]; }, POSES.openPalm());
  await expect(page.locator('#hands-status')).toHaveText('Mãos: 1');
  await page.evaluate(() => { window.__fake.hands = []; });
  await expect(page.locator('#hands-status')).toHaveText('Mãos: 0');
  expect(await page.evaluate(() => window.__fake.nonIncreasing)).toBe(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('#camera-status')).toHaveText('Câmera: desligada');
  expect(await page.evaluate(() => window.__fake.closed)).toBe(1);
});

test('a GPU delegate that fails falls back to the CPU delegate', async ({ page }) => {
  await fakeCameraAndModel(page, { failGpu: true });
  await page.goto('/');
  await page.waitForFunction(() => window.__app);
  await page.locator('#start-btn').click();
  await expect(page.locator('#camera-status')).toHaveText('Câmera: ativa');
  const delegates = await page.evaluate(() => window.__fake.created.map((o) => o.baseOptions.delegate));
  expect(delegates).toEqual(['GPU', 'CPU']);
  await expect(page.getByRole('alert')).toBeHidden();
});

test('a model failure while running stops the camera once and "Tentar novamente" restarts it', async ({ page }) => {
  const trackerErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error' && msg.text().includes('[HandTracker]')) trackerErrors.push(msg.text()); });
  await fakeCameraAndModel(page);
  await page.goto('/');
  await page.waitForFunction(() => window.__app);
  await page.locator('#start-btn').click();
  await expect(page.locator('#camera-status')).toHaveText('Câmera: ativa');

  await page.evaluate(() => { window.__fake.failSend = true; });
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Não foi possível carregar o modelo de mãos');
  // The failing loop stops instead of retrying on every frame.
  const sendsAfterError = await page.evaluate(() => window.__fake.sends);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__fake.sends)).toBe(sendsAfterError);
  expect(trackerErrors).toHaveLength(1);

  await page.evaluate(() => { window.__fake.failSend = false; });
  await alert.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('#camera-status')).toHaveText('Câmera: ativa');
  await expect(alert).toBeHidden();
});

test('a camera that disconnects while running is reported and can be restarted', async ({ page }) => {
  await fakeCameraAndModel(page);
  await page.goto('/');
  await page.waitForFunction(() => window.__app);
  await page.locator('#start-btn').click();
  await expect(page.locator('#camera-status')).toHaveText('Câmera: ativa');

  // stop() does not fire "ended" on the page's own track; dispatch it as the browser would.
  await page.evaluate(() => window.__fake.track.dispatchEvent(new Event('ended')));
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('A câmera parou de enviar imagem');
  await alert.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('#camera-status')).toHaveText('Câmera: ativa');
});

test('a fallback request after unsupported constraints keeps the denied message', async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    navigator.mediaDevices.getUserMedia = () => Promise.reject(
      new DOMException('blocked', ++calls === 1 ? 'OverconstrainedError' : 'NotAllowedError'));
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__app);
  await page.locator('#start-btn').click();
  await expect(page.getByRole('alert')).toContainText('A câmera foi bloqueada');
});
