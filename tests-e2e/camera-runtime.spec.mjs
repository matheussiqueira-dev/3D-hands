import { test, expect } from '@playwright/test';

// A canvas stream stands in for the webcam and a scripted `window.Hands` for
// MediaPipe, so these run fast and exercise the app's own runtime error paths.
async function fakeCameraAndModel(page) {
  await page.addInitScript(() => {
    window.__fake = { failSend: false, sends: 0, track: null };
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 48 });
      canvas.getContext('2d').fillRect(0, 0, 64, 48);
      const stream = canvas.captureStream(15);
      window.__fake.track = stream.getVideoTracks()[0];
      return stream;
    };
    window.Hands = class {
      setOptions() {}
      onResults(cb) { this._cb = cb; }
      async initialize() {}
      async send() {
        window.__fake.sends += 1;
        if (window.__fake.failSend) throw new Error('simulated inference failure');
        this._cb({ multiHandLandmarks: [], multiHandedness: [] });
      }
      close() {}
    };
  });
}

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
